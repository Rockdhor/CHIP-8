class CHIP8Emulator {
    constructor() {
        if (CHIP8Emulator._instance) {
            return CHIP8Emulator._instance
        }
        CHIP8Emulator._instance = this
        this.reset()
        this.keyboard = new Array(16).fill(false);
        this.setupKeyboardEventListeners()
        
        
    }
    
    mapKey(key) {
        switch (key) {
            case '1': return 0x1;
            case '2': return 0x2;
            case '3': return 0x3;
            case '4': return 0xC;
            case 'q': return 0x4;
            case 'w': return 0x5;
            case 'e': return 0x6;
            case 'r': return 0xD;
            case 'a': return 0x7;
            case 's': return 0x8;
            case 'd': return 0x9;
            case 'f': return 0xE;
            case 'z': return 0xA;
            case 'x': return 0x0;
            case 'c': return 0xB;
            case 'v': return 0xF;
            default: return -1; // Not a CHIP-8 key
        }
    }

    setupKeyboardEventListeners() {
        document.addEventListener('keydown', (event) => {
            const key = this.mapKey(event.key);
            if (key !== -1) {
                this.keyboard[key] = true;
            }
        });
        
        document.addEventListener('keyup', (event) => {
            const key = this.mapKey(event.key);
            if (key !== -1) {
                this.keyboard[key] = false;
            }
        });
    }

    reset() {
        this.memory = new Uint8Array(4096)
        this.PC = 0x200;
        this.I = 0
        this.SP = 0;
        this.stack = new Uint16Array(16)
        this.delayTimer = 0
        this.soundTimer = 0
        this.registers = new Uint8Array(16)
        this.audioCtx = new AudioContext();
        this.gainNode = this.audioCtx.createGain();
        this.gainNode.connect(this.audioCtx.destination);
        this.gainNode.gain.value = 0.25;
        this.beepOscillator = null;
        this.clearDisplay()
        this.stop()
        this.loadFont()
    }

    loadFont() {
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
        console.log(this.animationId)
        if (this.animationId !== null) {
            this.reset();
        }
        const romArray = new Uint8Array(rom)
        this.memory.set(romArray, 0x200)
    }

    run() {
        
        this.isRunning = true;
            const emulateFrame = () => {
                if (!this.isRunning) return
                for (let i = 0; i < 5; i++) {
                    this.emulateCycle()
                }

                if (this.delayTimer > 0) this.delayTimer--;
                this.updateSoundTimer()

                this.updateDisplay();
                this.animationId = requestAnimationFrame(emulateFrame)
            }
            emulateFrame();
        
    }

    emulateCycle() {
    if (this.PC >= this.memory.length || this.PC < 0x200) {  
        console.log("Program finished." + this.PC+  " " + this.memory.length);
        cancelAnimationFrame(this.animationId);
        return; 
      }
    
    // Fetch
    let opcode =(this.memory[this.PC] << 8) | (this.memory[this.PC + 1])
    //console.log("loop code:" +opcode.toString(16)+ " PC: " + this.PC.toString(16))
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
                this.clearDisplay()
            } else if (opcode == 0x00EE) {
                if (this.SP <= 0) { // Check for stack underflow FIRST
                    console.error("Stack underflow!");
                    break; // Important: Stop execution on underflow
                }
                this.SP--
                console.log("jumping to " + this.stack[this.SP].toString(16))
                this.PC = this.stack[this.SP]
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
            if (this.registers[X] === NN) {
                this.PC += 2
            }
            break;
        case (0x4000):
            if (this.registers[X] !== NN) {
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
        case (0x8000):
            let sum = 0
            switch (opcode & 0x000F) {
                
                case (0x0):
                    this.registers[X] = this.registers[Y]
                    break;
                case (0x1):
                    this.registers[X] |= this.registers[Y]
                    break;
                case (0x2):
                    this.registers[X] &= this.registers[Y]
                    break;
                case (0x3):
                    this.registers[X] ^= this.registers[Y]
                    break;
                case (0x4):
                    sum = this.registers[X] + this.registers[Y]
                    this.registers[X] = sum
                    this.registers[0xF] = sum > 255 ? 1 : 0
                    
                    break;
                case (0x5):
                    sum = this.registers[X] >= this.registers[Y]
                    this.registers[X] -= this.registers[Y]
                    this.registers[0xF] = sum ? 1 : 0
                    break
                case (0x7):
                    sum = this.registers[Y] >= this.registers[X]
                    this.registers[X] = this.registers[Y] - this.registers[X]
                    this.registers[0xF] = sum ? 1 : 0
                    break
                case (0x6):
                    //TODO: Implement quirk.
                    sum = this.registers[X] & 0x1
                    this.registers[X] >>= 1
                    this.registers[0xF] = sum
                    break;
                case (0xE):
                    //TODO: Implement quirk.
                    sum = (this.registers[X] >> 7)
                    this.registers[X] <<= 1
                    this.registers[0xF] = sum
                    break;
            }
            break;
        case (0x9000):
            if (this.registers[X] != this.registers[Y]) {
                this.PC += 2
            }
            break;
        case (0xA000):
            this.I = NNN
            break;
        case (0xB000):
            // TODO: Implement quirk.
            this.PC = NNN + this.registers[0]
            break;
        case (0xC000):
            this.registers[X] = NN & Math.floor(Math.random() * 0xFF)
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
        case (0xE000):
            // TODO: Implement input
            const keyIsPressed = this.keyboard[this.registers[X]]
            switch (opcode & 0xFF) {
                case (0x9E):
                    if (keyIsPressed) this.PC += 2;
                    break;
                case (0xA1):
                    if (!keyIsPressed) this.PC += 2;
                    break;
            }
            break;
        case (0xF000):
            const modern = true
            switch (opcode & 0xFF) {
                case (0x07):
                    this.registers[X] = this.delayTimer
                    break;
                case (0x15):
                    this.delayTimer = this.registers[X]
                    break;
                case (0x18):
                    this.soundTimer = this.registers[X]
                    break;
                case (0x1E):
                    // Consider implementing the AMIGA behavior.
                    this.I += this.registers[X]
                    break;
                case (0x0A):
                    let keyIsPressed = false
                    for (let i = 0; i < 16; i++) {
                        if (this.keyboard[i]) {
                            this.registers[X] = i;
                            keyIsPressed = true;
                            break;
                        }
                    }
                    if (!keyIsPressed) {
                        this.PC -= 2
                        return;
                    }
                    
                    break;
                case (0x29):
                    this.I = this.registers[X] * 5 + 0x050
                    break;
                case (0x33):
                    if (this.I + 2 >= this.memory.length) {
                        console.error("FX33: Memory access out of bounds! I:", this.I);
                        this.stop();
                    }
                    const x = this.registers[X]
                    this.memory[this.I] = Math.trunc(x/100) 
                    this.memory[this.I+1] = Math.trunc(x%100 / 10) 
                    this.memory[this.I+2] = x % 10
                    console.log(this.registers[X], this.memory[this.I+0], this.memory[this.I+1], this.memory[this.I+2])
                    break;
                case (0x55):
                    // TODO: Implement quirk.
                    for (let i = 0; i <= X; i++) {
                        this.memory[this.I + i] = this.registers[i]
                    }
                    break;
                case (0x65):
                    // TODO: Implement quirk.
                    for (let i = 0; i <= X; i++) {
                        this.registers[i] = this.memory[this.I + i]
                    }
                    break;
            }
            break;
        default:
            console.error("Unknown opcode:", opcode.toString(16), "at PC:", this.PC.toString(16));
            break;   
        }
    }

    stop() {
        if (this.animationId != null) {
            cancelAnimationFrame(this.animationId);
            this.isRunning = false
            this.animationId = null
        }
    }

    clearDisplay() {
        this.display = Array.from({ length: 32 }, () => Array(64).fill(false));
    }

    updateDisplay() {
        const ctx = document.getElementById("display").getContext("2d")
        const pixelSize = 12
        for (let y = 0; y < 32; y++) {
            for (let x = 0; x < 64; x++) {          
                ctx.fillStyle = this.display[y][x] ? "black" : "white";
                ctx.fillRect(x*pixelSize,y*pixelSize,pixelSize,pixelSize)
            }
        }
    }

    updateSoundTimer() {
        if (this.soundTimer > 0) {
            this.playSound();
            this.soundTimer--;
        } else {
            this.stopSound(); 
        }
    }

    playSound() {
        if (!this.beepOscillator) {
            this.beepOscillator = this.audioCtx.createOscillator();
            this.beepOscillator.type = "square";
            this.beepOscillator.frequency.value = 440; 
            this.beepOscillator.connect(this.gainNode);
            this.beepOscillator.start(0);
        }
        
    }

    stopSound() {
        if (this.beepOscillator) {
            this.beepOscillator.stop(0);
            this.beepOscillator.disconnect(0);
            this.beepOscillator = null;
        }
    }
}

document.getElementById("romPicker").onchange = async (e) => {
    console.log(e.target.value)
    if (e.target.value == "Custom") {
        document.querySelectorAll(".filePicker").forEach((e) => {
            e.style.display = "inline"
            emulator = new CHIP8Emulator();
            emulator.reset()
            emulator.updateDisplay()
        })
        return
    }
    document.querySelectorAll(".filePicker").forEach((e) => {
        e.style.display = "none"
    })
    let response = await fetch(e.target.value)
    console.log(response)
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    const rom = await response.arrayBuffer();
    emulator = new CHIP8Emulator();
    emulator.loadRom(rom);
    emulator.run();
    
}

document.getElementById("fileLoadButton").onclick = () => {
    let filePicker = document.getElementById("fileInput")
    let file = filePicker.files[0]
    console.log(file)
    if (file) {
        console.log("k")
        const reader = new FileReader();
        reader.onload = (e) => {
            const rom = e.target.result;
            emulator = new CHIP8Emulator();
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



