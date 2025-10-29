function seededRandom(x, y, seed = 0) {
    let n = x * 374761393 + y * 668265263 + seed * 1442695040888963407;
    n = (n ^ (n >> 13)) * 1274126177;
    return ((n ^ (n >> 16)) >>> 0) / 4294967296;
}

class SandGrid {
    constructor(width, height) {
        this.width = Math.floor(width);
        this.height = Math.floor(height);
        this.array = new Array(this.width * this.height).fill(0);
    }

    index(x, y) { return (y * this.width) + x; }
    get(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return null;
        return this.array[this.index(x, y)];
    }
    set(x, y, v) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
        this.array[this.index(x, y)] = v;
    }

    swap(a, b) {
        if (!a || !b) return;
        const tmp = this.array[a];
        this.array[a] = this.array[b];
        this.array[b] = tmp;
    }
}

class SandSimulator {
    constructor(width, height, cellSize) {
        this.width = width;
        this.height = height;
        this.cellSize = cellSize;

        this.canvas = document.getElementsByClassName("sandJScanvas")[0];
        this.canvas.width = width * cellSize;
        this.canvas.height = height * cellSize;
        this.ctx = this.canvas.getContext("2d");

        this.imgdata = this.ctx.createImageData(this.width * this.cellSize, this.height * this.cellSize);
        this.data = this.imgdata.data;

        this.mx = 0;
        this.my = 0;
        this.brushSize = 2;
        this.paint_down = false;
        this.erase_down = false;
        this.active_paint = "sand";

        this.canvas.addEventListener("mousemove", function(e) {
            var rect = this.canvas.getBoundingClientRect();
            this.mx = Math.floor((e.clientX - rect.left) / this.cellSize);
            this.my = Math.floor((e.clientY - rect.top) / this.cellSize);
        }.bind(this));

        var _this = this;
        function setMouseState(button, value) {
            if (button == 0)
                _this.paint_down = value;
            else if (button == 2)
                _this.erase_down = value;
        }

        this.canvas.addEventListener("mousedown", function(e) {
            setMouseState(e.button, true);
        }.bind(this));

        this.canvas.addEventListener("mouseup", function(e) {
            setMouseState(e.button, false);
        }.bind(this))

        /* base: blank, powder, solid, liquid */
        this.elements = [
            { type: "air", id: 0, grain: false, color: [0x1F, 0x2C, 0x33] },
            { type: "sand", id: 1, grain: true, color: [0xFF, 0xE9, 0x80], 
            update: function(x, y, elements, grid) {
                const rand = Math.sign(Math.random() - 0.5);

                const below = elements[grid.get(x, y + 1)];
                const diag = elements[grid.get(x + rand, y + 1)];

                if (below && below.type == "air")
                    grid.swap(grid.index(x, y), grid.index(x, y + 1));
                else if (diag && diag.type == "air")
                    grid.swap(grid.index(x, y), grid.index(x + rand, y + 1));
            }},
            { type: "water", id: 2, grain: true, color: [0x4D, 0xD2, 0xFF],
            update: function(x, y, elements, grid) {
                const rand = Math.sign(Math.random() - 0.5);

                const below = elements[grid.get(x, y + 1)];
                const diag = elements[grid.get(x + rand, y + 1)];
                const side = elements[grid.get(x + rand, y)];

                if (below && below.type == "air")
                    grid.swap(grid.index(x, y), grid.index(x, y + 1));
                else if (diag && diag.type == "air")
                    grid.swap(grid.index(x, y), grid.index(x + rand, y + 1));
                else if (side && side.type == "air")
                    grid.swap(grid.index(x, y), grid.index(x + rand, y));
            }},
            { type: "wood", id: 3, grain: false, color: [0x59, 0x44, 0x2D] }
        ];

        this.grid = new SandGrid(this.width, this.height);
        for (let y = 0; y < this.height; y++)
            for (let x = 0; x < this.width; x++)
                this.setAtPosition(x, y, "air");
    }

    addElement(def) {
        if (typeof(def) !== "object") return;
        def.id = this.elements.length;

        const color = def.color;
        const r = (color >> 16) & 0xFF;
        const g = (color >> 8)  & 0xFF;
        const b = (color)       & 0xFF
        def.color = [r, g, b];

        this.elements.push(def);

        return def.id;
    }

    setAtPosition(x, y, name) {
        const e = this.elements.find(e => e.type === name);
        if (!e) return;
        this.grid.set(x, y, e.id);
    }

    update() {
        const pix_width  = this.width  * this.cellSize;    
        
        for (let y = this.height - 1; y >= 0; y--) {
            for (let x = this.width - 1; x >= 0; x--) {
                const id = this.grid.get(x, y);
                const def = this.elements[id];
                
                if (def.update) def.update(x, y, this.elements, this.grid);
                const pixelGrain = (id == 0) ? 0 : seededRandom(x, y) * 32;

                for (let dy = 0; dy < this.cellSize; dy++) {
                    for (let dx = 0; dx < this.cellSize; dx++) {
                        const pix = (y * this.cellSize + dy) * pix_width + (x * this.cellSize + dx);
                        const p = pix * 4;
                        this.data[p]     = Math.min(255, def.color[0] + pixelGrain);
                        this.data[p + 1] = Math.min(255, def.color[1] + pixelGrain);
                        this.data[p + 2] = Math.min(255, def.color[2] + pixelGrain);
                        this.data[p + 3] = 255;
                    }
                }
            }
        }

        this.ctx.putImageData(this.imgdata, 0, 0);
        
        if (this.paint_down || this.erase_down) {
            const r = this.brushSize;
            const rsq = r * r;

            const start_x = Math.floor(this.mx - r);
            const start_y = Math.floor(this.my - r);
            const end_x = Math.floor(this.mx + r);
            const end_y = Math.floor(this.my + r);

            const active_type = this.elements.find(e => e.type === this.active_paint)
            var active_grain = active_type.grain;

            for (let y = start_y; y <= end_y; y++) {
                for (let x = start_x; x <= end_x; x++) {
                    if (this.paint_down && active_grain && Math.random() > 0.5) continue;

                    const dx = x - this.mx;
                    const dy = y - this.my;
                    const dsq = dx * dx + dy * dy;
                    
                    if (dsq <= rsq) this.setAtPosition(x, y, this.paint_down ? this.active_paint : "air");
                }
            }
        }
    }
}

var sim;
changeTool = e => sim.active_paint = e.innerHTML;
function sandJSInit(w, h, scale) {
    const appendedStyles = document.createElement("style");
    appendedStyles.innerHTML = ".sandJScanvas{margin:auto;display:block;cursor:url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA0AAAAQCAYAAADNo/U5AAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAABmZVhJZklJKgAIAAAAAQBphwQAAQAAABoAAAAAAAAAAwAAkAcABAAAADAyMzABoAMAAQAAAAEAAAAFoAQAAQAAAEQAAAAAAAAAAgABAAIABAAAAFI5OAACAAcABAAAADAxMDAAAAAAIvvHMbnUA7gAAAH2SURBVDhPjZK/axphHMbP8/cPiD+mGmxcTJcWO2kWjUPRZJBCJ5d2l0yatVMdLB1C1vwB3SRCEIc4GRcHC62gFEIgOkQieprUuzOed9fne6lHKCHkgQ/ve+/7PPd+7/seA22B72ADGGnhOTo1GAw8y7JdzA/AC231KZlMph8+n2+ZSqVEo9G4xNIF+AictP+orFbridvtlnu9nlIulxW/3z/ByTfYOgabgCXf//ridDrv+v0+r0LD4VDNZrM8Th1h7xzsAw8ZH+qDzWabt1qtOYVIkiSptVpNcjgcHezL4CfYBXqj3pnN5kWpVNJDKw0Gg9t0Oj1EJbcoeQLvIfBS6LXFYhEKhQKFHgaVf6Pa6XTUaDQqwUunHlFo3eVyzTKZjIz92b1NlxasVqvUIBnXwsH/iUJur9c7TiaTsiiKq7fTqM1zudwIpQnw7QG9k2sej2eQSCQkQRAkMpIw10ptNpsy7nEKH93ftpaA1nDSFYV4nu9Op9M5mrIMh8PjdrutKoqiNhoNGd99DS9dwdtV6DIWiyn5fH4RDAb/wEDdGkciEZ7jOO3kSqWysNvt1EG6dIYNBALvQ6HQb/xSHMy/sPYZvAFiPB6f1+t1pVgsLtF6KvMb0PUSRIBDe7rXV0D/4wIvm2FsglfgSbkAlXMGdoCdYRjmL+rYG7EZqdBcAAAAAElFTkSuQmCC')0 0,auto;}.sandJSSelection{border:2px solid #222;border-radius:0;background-color:#333;color:#eee;margin-top:8px;}.sandJSSelection:active{background-color:#444;}";
    document.body.appendChild(appendedStyles);

    sim = new SandSimulator(w / scale, h / scale, scale);
    [].forEach(e => sim.addElement(e)); /* extensions supported (override this, please!) */

    let cube_width = 10;
    let half_sw = Math.floor(sim.width / 2);
    let half_sh = Math.floor(sim.height / 2);

    for (let y = half_sh - (cube_width / 2); y < half_sh + (cube_width / 2); y++)
        for (let x = half_sw - (cube_width / 2); x < half_sw + (cube_width / 2); x++)
            sim.setAtPosition(x, y, "sand");

    function loop() {
        sim.update();
        if (typeof(external_update) == "function") external_update(sim);
        requestAnimationFrame(loop);
    }
    loop();
}