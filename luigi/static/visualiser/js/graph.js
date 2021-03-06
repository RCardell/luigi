Graph = (function() {
    var statusColors = {
        "FAILED":"#DD0000",
        "DONE":"#00DD00",
        "PENDING":"#EEBB00",
        "RUNNING":"#0044DD"
    };

    function nodeFromTask(task) {
        var deps = task.deps;
        deps.sort();
        return {
            taskId: task.taskId,
            status: task.status,
            trackingUrl: "#"+task.taskId,
            deps: deps,
            depth: -1
        };
    }

    /* Convert array to dict by indexing on propertyName */
    function uniqueIndexByProperty(data, propertyName) {
        var nodeIndex = {};
        $.each(data, function(i, dataPoint) {
            nodeIndex[dataPoint[propertyName]] = i;
        });
        return nodeIndex;
    }

    /* Create edges between the supplied node using the deps property of each node */
    function createDependencyEdges(nodes, nodeIndex) {
        var edges = [];
        $.each(nodes, function(i, task) {
            $.each(task.deps, function(j, dep) {
                if (nodeIndex[dep]) {
                    edges.push({
                        source: nodes[nodeIndex[task.taskId]],
                        target: nodes[nodeIndex[dep]]
                    });
                }
            });
        });
        return edges;
    }

    /* Compute the maximum depth of each node for layout purposes, returns the number
       of nodes at each depth level (for layout purposes) */
    function computeDepth(nodes, nodeIndex) {
        var rowSizes = [];
        function descend(n, depth) {
            n.depth = depth;
            if (rowSizes[depth] === undefined) {
                rowSizes[depth] = 0;
            }
            n.xOrder = rowSizes[depth];
            rowSizes[depth]++;
            $.each(n.deps, function(i, dep) {
                if (nodeIndex[dep]) {
                    descend(nodes[nodeIndex[dep]], depth + 1);
                }
            });
        }
        descend(nodes[0], 0);
        return rowSizes;
    }

    /* Format nodes according to their depth and horizontal sort order.
       Algorithm: evenly distribute nodes along each depth level, offsetting each
       by the text line height to prevent overlapping text. The height of each
       depth level is therefore determined by the number of nodes at that depth. */
    function layoutNodes(nodes, rowSizes) {
        function rowStartPosition(depth) {
            if (depth === 0) return 20;
            return rowStartPosition(depth-1)+Math.max(rowSizes[depth-1]*10+10,100);
        }
        $.each(nodes, function(i, node) {
            node.x = ((node.xOrder+1)/(rowSizes[node.depth]+1))*(graphWidth-200)+100;
            node.y = rowStartPosition(node.depth) + (node.xOrder*10);
        });
    }

    /* Parses a list of tasks to a graph format */
    function createGraph(tasks) {
        if (tasks.length === 0) return {nodes: [], links: []};

        var nodes = $.map(tasks, nodeFromTask);
        var nodeIndex = uniqueIndexByProperty(nodes, "taskId");

        var rowSizes = computeDepth(nodes, nodeIndex);

        nodes = $.map(nodes, function(node) { return node.depth >= 0 ? node: null; });

        layoutNodes(nodes, rowSizes);

        // We need to re-index nodes after filtering
        nodeIndex = uniqueIndexByProperty(nodes, "taskId");
        var edges = createDependencyEdges(nodes, nodeIndex);

        return {
            nodes: nodes,
            links: edges
        };
    }

    function findBounds(nodes) {
        var maxX = 0;
        var maxY = 0;
        $.each(nodes, function(i, node) {
            if (node.x>maxX) maxX = node.x;
            if (node.y>maxY) maxY = node.y;
        });
        return {
            x:maxX,
            y:maxY
        };
    }

    var graphWidth = 1110;

    function DependencyGraph(containerElement) {
        this.svg = $(svgElement("svg")).appendTo($(containerElement));
    }


    /* We need custom element creators for svg nodes and xlink attributes because jQuery doesn't support
       namespaces properly */
    function svgElement(name) {
        return document.createElementNS("http://www.w3.org/2000/svg", name);
    }

    function svgLink(url) {
        var element = svgElement("a");
        element.setAttributeNS("http://www.w3.org/1999/xlink", "href", url);
        return element;
    }

    DependencyGraph.prototype.renderGraph = function() {
        var self = this;

        $.each(this.graph.links, function(i, link) {
            var line = $(svgElement("line"))
                        .attr("class","link")
                        .attr("x1", link.source.x)
                        .attr("y1", link.source.y)
                        .attr("x2", link.target.x)
                        .attr("y2", link.target.y)
                        .appendTo(self.svg);
        });

        $.each(this.graph.nodes, function(i, node) {
            var g = $(svgElement("g"))
                .addClass("node")
                .attr("transform", "translate(" + node.x + "," + node.y +")")
                .appendTo(self.svg);
            $(svgElement("circle"))
                .addClass("nodeCircle")
                .attr("r", 7)
                .attr("fill", statusColors[node.status])
                .appendTo(g);
            $(svgLink(node.trackingUrl))
                .append(
                    $(svgElement("text"))
                    .text(node.taskId)
                    .attr("y", 3))
                .attr("class","graph-node-a")
                .attr("data-task-status", node.status)
                .attr("data-task-id", node.taskId)
                .appendTo(g);
        });
    };

    DependencyGraph.prototype.updateData = function(taskList) {
        this.graph = createGraph(taskList);
        bounds = findBounds(this.graph.nodes);
        this.renderGraph();
        this.svg.attr("height", bounds.y+10);
    };

    return {
        DependencyGraph: DependencyGraph,
        testableMethods: {
            nodeFromTask: nodeFromTask,
            uniqueIndexByProperty: uniqueIndexByProperty,
            createDependencyEdges: createDependencyEdges,
            computeDepth: computeDepth,
            createGraph: createGraph,
            findBounds: findBounds
        }
    };
})();
