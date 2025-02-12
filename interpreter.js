document.getElementById("fileLoadButton").onclick = () => {
    let filePicker = document.getElementById("fileInput")
    let file = filePicker.files[0]
    console.log(file)
    if (file) {
        console.log("k")
        const reader = new FileReader();
        reader.onload = (e) => {
            const rom = e.target.result;
            const emulator = new CHIP8Emulator();
            emulator.loadRom(rom);
            emulator.run();
        }
        reader.onerror = (err) => {
            console.error("Error reading file:", err);
            alert("Error loading ROM. Please try again.");
        };
        reader.readAsArrayBuffer(file);
    } 
}

class CHIP8Emulator {
    constructor() {
        this.memory = new Uint8Array(4096)
        this.PC = 0x200;
        this.I = 0
        this.SP = 0;
        this.stack = new Uint8Array(16)
        this.delayTimer = 0
        this.soundTimer = 0
        this.registers = new Uint8Array(16)
        this.display = Array.from({ length: 32 }, () => Array(64).fill(false));

        // Load font set (example)
        const fontSet = new Uint8Array([
            0xF0, 0x90, 0x90, 0x90, 0xF0, // 0
            0x20, 0x60, 0x20, 0x20, 0x70, // 1
            0xF0, 0x10, 0xF0, 0x80, 0xF0, // 2
            0xF0, 0x10, 0xF0, 0x10, 0xF0, // 3
            0x90, 0x90, 0xF0, 0x10, 0x10, // 4
            0xF0, 0x80, 0xF0, 0x10, 0xF0, // 5
            0xF0, 0x80, 0xF0, 0x90, 0xF0, // 6
            0xF0, 0x10, 0x20, 0x40, 0x40, // 7
            0xF0, 0x90, 0xF0, 0x90, 0xF0, // 8
            0xF0, 0x90, 0xF0, 0x10, 0xF0, // 9
            0xF0, 0x90, 0xF0, 0x90, 0x90, // A
            0xE0, 0x90, 0xE0, 0x90, 0xE0, // B
            0xF0, 0x80, 0x80, 0x80, 0xF0, // C
            0xE0, 0x90, 0x90, 0x90, 0xE0, // D
            0xF0, 0x80, 0xF0, 0x80, 0xF0, // E
            0xF0, 0x80, 0xF0, 0x80, 0x80  // F
        ]);
        this.memory.set(fontSet, 0x050); // Load at address 0x050
    }

    loadRom(rom) {
        const romArray = new Uint8Array(rom)
        this.memory.set(romArray, 0x200)
    }

    run() {
        let exec = true
        console.log("runnin")
        while (exec) {
            if (this.PC >= this.memory.length || this.PC < 0x200) {  
                console.log("Program finished.");
                break; 
              }
            
            // Fetch
            let opcode =(this.memory[this.PC] << 8) | (this.memory[this.PC + 1])
            console.log("loop code:" +opcode.toString(16)+ " PC: " + this.PC.toString(16))
            this.PC += 2
            
            const X = (opcode & 0x0F00) >> 8
            const Y = (opcode & 0x00F0) >> 4
            const N = opcode & 0x000F
            const NN = opcode & 0x00FF
            const NNN = opcode & 0x0FFF
            
            // Then Decode + Execute
            switch (opcode & 0xF000) {
                case (0x0000):
                    if (opcode == 0x00E0) {
                        this.display = Array.from({ length: 32 }, () => Array(64).fill(false));
                    } else if (opcode == 0x00EE) {
                        if (this.SP <= 0) { // Check for stack underflow FIRST
                            console.error("Stack underflow!");
                            break; // Important: Stop execution on underflow
                        }
                        this.SP--
                        this.PC = this.stack[this.SP] - 2
                    }
                    break;
                case (0x1000):
                    if (NNN == this.PC-2) {
                        return;
                    }
                    this.PC = NNN
                    break;
                case (0x2000):
                    if (this.SP >= 16) {
                        console.error("Stack overflow!");
                        break;
                    }
                    this.stack[this.SP] = this.PC
                    this.SP++
                    this.PC = NNN
                    break;
                case (0x3000):
                    if (this.registers[X] == NN) {
                        this.PC += 2
                    }
                    break;
                case (0x4000):
                    if (this.registers[X] != NN) {
                        this.PC += 2
                    }
                    break;
                case (0x5000):
                    if (this.registers[X] == this.registers[Y]) {
                        this.PC += 2
                    }
                    break;
                case (0x6000):
                    this.registers[X] = NN
                    break;
                case (0x7000):
                    this.registers[X] += NN
                    break;
                case (0x9000):
                    if (this.registers[X] != this.registers[Y]) {
                        this.PC += 2
                    }
                    break;
                case (0xA000):
                    this.I = NNN
                    break;
                case (0xD000):
                    const x = this.registers[X] % 64
                    const y = this.registers[Y] % 32
                    this.registers[0x000F] = 0
                    for (let i = 0; i < N; i++) {
                        if (y+i >= 32) {
                            break;
                        }
                        const spriteData = this.memory[this.I+i]
                        for (let j = 0; j < 8; j++) {
                            if (x+j >= 64) {
                                break;
                            }
                            if ((spriteData >> (7 - j)) & 0x01) {
                                if (this.display[y+i][x+j] == true) {
                                    this.display[y+i][x+j] = false
                                    this.registers[0x000F] = 1
                                } else {
                                    this.display[y+i][x+j] = true
                                }
                            }
                        }
                        
                    }
                    break;
                    default:
                        console.error("Unknown opcode:", opcode.toString(16), "at PC:", this.PC.toString(16));
                        break;   
            }
            
            this.updateDisplay()
            // Timers
            if (this.delayTimer > 0) {
                this.delayTimer--;
            }
            if (this.soundTimer > 0) {
                this.soundTimer--;
                // Play sound (if sound_timer reaches 0)
            }
        }
    }

    updateDisplay() {
        console.log("called")
        const ctx = document.getElementById("display").getContext("2d")
        const pixelSize = 11
        for (let y = 0; y < 32; y++) {
            for (let x = 0; x < 64; x++) {          
                ctx.fillStyle = this.display[y][x] ? "black" : "white";
                ctx.fillRect(x*pixelSize,y*pixelSize,pixelSize,pixelSize)
            }
        }
    }
}

