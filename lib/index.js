const style = require("./style.js");
const comparers = require("./comparers.js");
class ConsoleGrid {
    constructor() {
        this.style = style;
        this.columns = [];
        this.rows = [];
    }

    setData(data) {
        this.data = data || {};
        this.setOption(this.data.option);
        this.setColumns(this.data.columns);
        this.setRows(this.data.rows);
        return this;
    }

    setOption(option) {
        var defaultOption = {

            border: {
                h: '─',
                v: '│',
                top_left: '┌',
                top_mid: '┬',
                top_right: '┐',
                mid_left: '├',
                mid_mid: '┼',
                mid_right: '┤',
                bottom_left: '└',
                bottom_mid: '┴',
                bottom_right: '┘'
            },

            hideHeaders: false,

            padding: 1,
            defaultMaxWidth: 30,

            sortField: "",
            sortAsc: false,

            treeId: "name",
            treeIcon: "|- ",
            treeIndent: "   ",
            defaultTreeFormatter: this.defaultTreeFormatter,
            defaultFormatter: this.defaultFormatter,
            nullPlaceholder: "-"
        };

        if (option) {
            this.option = Object.assign(defaultOption, option);
        } else if (!this.option) {
            this.option = defaultOption;
        }
        return this;
    }

    setColumns(columns) {
        if (!Array.isArray(columns)) {
            columns = [];
        }
        this.columns = columns;
        return this;
    }

    setRows(rows) {
        if (!Array.isArray(rows)) {
            rows = [];
        }
        this.rows = rows;
        return this;
    }

    //=====================================================================================================

    defaultTreeFormatter(v, row, column) {
        var indent = "";
        var level = row.cg_level;
        while (level > 0) {
            indent += this.option.treeIndent;
            level -= 1;
        }
        var str = indent + this.option.treeIcon + v;
        return str;
    }

    defaultFormatter(v, row, column) {
        return v;
    }

    forEachTree(tree, callback) {
        if (typeof (callback) !== "function") {
            return this;
        }
        var forEachAll = function (tree, parent) {
            if (!Array.isArray(tree)) {
                return;
            }
            for (var i = 0, l = tree.length; i < l; i++) {
                var item = tree[i];
                var result = callback.call(this, item, i, parent);
                if (result === false) {
                    return false;
                }
                var subResult = forEachAll(item.subs, item);
                if (subResult === false) {
                    return false;
                }
            }
        };
        forEachAll(tree);
        return this;
    }

    //=====================================================================================================

    initData() {
        this.initOption();
        this.initGridColumns();
        this.initGridRows();
        this.initGridHeaders();
    }

    initOption() {
        this.paddingChar = this.getChar(this.option.padding, " ");
    }

    initGridColumns() {
        this.columns.forEach((column, i) => {
            column.cg_index = i;

            var name = column.name + "";
            name = name.replace(/\s/g, " ");
            column.name = name;

            if (typeof (column.formatter) === "function") {
                column.cg_formatter = column.formatter;
            } else {
                if (column.id === this.option.treeId) {
                    column.cg_formatter = this.option.defaultTreeFormatter;
                } else {
                    column.cg_formatter = this.option.defaultFormatter;
                }
            }
        });
    }

    //=====================================================================================================

    initGridRows() {

        this.sortRows();

        this.gridRows = [];
        var index = 0;
        this.forEachTree(this.rows, (row, i, parent) => {
            var level = 0;
            if (parent) {
                level = parent.cg_level + 1;
            }
            row.cg_level = level;
            row.cg_index = index++;
            this.initRowProperties(row);

            this.gridRows.push(row);
        });

        //console.log(this.gridRows);
    }

    getSortColumn() {
        var sortField = this.option.sortField;
        if (!sortField) {
            return null;
        }
        for (var i = 0, l = this.columns.length; i < l; i++) {
            var column = this.columns[i];
            if (column.id === sortField) {
                return column;
            }
        }
        return null;
    }

    getSortComparer() {
        var type = this.sortColumn.type;
        var comparer = comparers[type] || comparers.string;
        return comparer;
    }

    sortRows() {
        this.sortColumn = this.getSortColumn();
        if (!this.sortColumn) {
            return;
        }

        var sortAll = (list) => {
            if (!Array.isArray(list)) {
                return;
            }
            if (list.length > 1) {
                this.sortList(list);
            }
            list.forEach((item) => {
                if (item && item.subs) {
                    sortAll(item.subs);
                }
            });
        };

        sortAll(this.rows);

    }

    sortList(list) {

        var sortField = this.sortColumn.id;
        var sortAsc = this.option.sortAsc;
        var sortFactor = sortAsc ? -1 : 1;
        var sortBlankFactor = 1;
        var comparer = this.getSortComparer();

        list.sort((a, b) => {
            var option = {
                sortField: sortField,
                sortFactor: sortFactor,
                sortBlankFactor: sortBlankFactor
            };
            return comparer.call(this, a, b, option);
        });

    }

    initRowProperties(row) {
        this.columns.forEach(column => {
            //init row value
            var str = column.cg_formatter.call(this, row[column.id], row, column);
            if (typeof (str) === "undefined" || str === null) {
                str = this.option.nullPlaceholder;
            } else {
                str = str + "";
                str = str.replace(/\s/g, " ");
            }
            row[this.getColumnKey(column)] = str;
        });
    }

    //=====================================================================================================

    initGridHeaders() {
        this.maxHeaderLines = 1;
        this.columns.forEach(column => {
            //width depends columns and rows
            column.cg_width = this.getColumnWidth(column);

            //lines depends column width
            var lines = this.getHeaderLines(column);
            this.maxHeaderLines = Math.max(this.maxHeaderLines, lines.length);
            column.cg_lines = lines;

        });
        //console.log(this.maxHeaderLines);

        //init lines length
        this.columns.forEach(column => {
            var lines = column.cg_lines;
            while (lines.length < this.maxHeaderLines) {
                lines.unshift("");
            }
        });

        //console.log(this.columns);

    }

    getColumnWidth(column) {
        var w = this.getCharLength(column.name);
        this.gridRows.forEach(row => {
            var str = row[this.getColumnKey(column)];
            var len = this.getCharLength(str);
            w = Math.max(w, len);
        });
        var maxWidth = column.maxWidth;
        if (typeof (maxWidth) !== "number") {
            maxWidth = this.option.defaultMaxWidth;
        }
        w = Math.min(w, maxWidth);
        w = Math.max(w, 3);
        return w;
    }

    getHeaderLines(column) {

        var columnWidth = column.cg_width;
        var str = column.name;
        var lenNoColor = this.getCharLength(str);
        if (lenNoColor < columnWidth) {
            return [str];
        }
        var lines = [];
        var list = str.split(" ");
        while (list.length) {
            var item = list.shift();
            while (list.length && this.getCharLength(item + list[0]) < columnWidth) {
                item += " " + list.shift();
            }
            lines.push(item);
        }

        //console.log(lines);

        return lines;
    }

    //=====================================================================================================

    getCharByWidth(str, w) {
        var strNoColor = this.getCharNoColor(str);
        if (strNoColor.length <= w) {
            return str;
        }

        var list = str.split(" ");
        var item = list.shift();
        //first one overflow
        var lenNoColor = this.getCharLength(item);
        if (lenNoColor > w) {
            item = this.getCharNoColor(item);
            item = item.substr(0, w - 3) + "...";
            return item;
        }

        //next one append, 4 is place for space + ...
        while (list.length && this.getCharLength(item + list[0]) < w - 4) {
            item += " " + list.shift();
        }

        //+1 space
        var lenCurrent = this.getCharLength(item) + 1;
        //last str overflow
        var last = list.join(" ");
        last = this.getCharNoColor(last);
        var lenLast = w - lenCurrent;

        last = last.substr(0, lenLast - 3) + "...";
        item += " " + last;

        //console.log(item);

        return item;
    }

    getCharNoColor(char) {
        return char.replace(/\033\[(\d+)m/g, '');
    }

    getCharLength(char) {
        //console.log(char, char.length);
        char = this.getCharNoColor(char);
        //console.log(char, char.length);
        return char.length;
    }

    getChar(len, str = " ") {
        if (len < 1) {
            return "";
        }
        var arr = new Array(len + 1);
        return arr.join(str);
    }

    getColumnKey(column) {
        return ["cg", column.cg_index, column.id].join("_");
    }

    getCell(column, str) {
        var columnWidth = column.cg_width;
        var lenNoColor = this.getCharLength(str);
        if (lenNoColor > columnWidth) {
            str = this.getCharByWidth(str, columnWidth);
            lenNoColor = this.getCharLength(str);
        }
        var spaceLen = column.cg_width - lenNoColor;
        var cell = str + this.getChar(spaceLen);
        return cell;
    }

    consoleLog(msg) {
        console.log(msg);
    }


    //=====================================================================================================

    renderRowBorder(position) {
        var B = this.option.border;
        var list = [];
        this.columns.forEach(column => {
            list.push(this.getChar(column.cg_width, B.h));
        });
        var char = this.paddingChar + B[position + "_mid"] + this.paddingChar;
        var line = list.join(char);
        line = B[position + "_left"] + this.paddingChar + line + this.paddingChar + B[position + "_right"];
        this.consoleLog(line);
        return this;
    }

    renderHeader(i) {
        var B = this.option.border;
        var list = [];
        this.columns.forEach(column => {
            var str = column.cg_lines[i] || "";
            var cell = this.getCell(column, str);
            list.push(cell);
        });
        var char = this.paddingChar + B.v + this.paddingChar;
        var line = list.join(char);
        line = B.v + this.paddingChar + line + this.paddingChar + B.v;
        this.consoleLog(line);
    }

    renderHeaders() {
        var i = 0;
        while (i < this.maxHeaderLines) {
            this.renderHeader(i);
            i += 1;
        }
        return this;
    }

    renderRow(row) {
        //console.log(row);
        var B = this.option.border;
        var list = [];
        this.columns.forEach(column => {
            var str = row[this.getColumnKey(column)];
            var cell = this.getCell(column, str);
            list.push(cell);
        });
        var char = this.paddingChar + B.v + this.paddingChar;
        var line = list.join(char);
        line = B.v + this.paddingChar + line + this.paddingChar + B.v;
        this.consoleLog(line);
        return this;
    }

    renderRows() {
        this.gridRows.forEach(row => {
            this.renderRow(row);
        });
        return this;
    }

    render(data) {
        this.setData(data);
        this.initData();

        this.renderRowBorder("top");
        if (!this.option.hideHeaders) {
            this.renderHeaders();
            this.renderRowBorder("mid");
        }
        this.renderRows();
        this.renderRowBorder("bottom");
    }

}

ConsoleGrid.style = style;

module.exports = ConsoleGrid;