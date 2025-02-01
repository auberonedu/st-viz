/**
 * Screwtape Visualizer
 *  - Modified BF: no forward jumps on '['; ']' jumps back if current cell != 0.
 *  - Tape is modeled as a doubly linked list (infinite in both directions).
 *  - Cells are treated as signed 32-bit integers in the range [-2147483648, 2147483647],
 *    with overflow/underflow.
 *  - Non-printing characters are rendered symbolically.
 *  - The program text is displayed with the current instruction in bold red.
 *  - A slider controls the speed (ms delay per step).
 */

const programInput = document.getElementById("program");
const runBtn = document.getElementById("runBtn");
const stepBtn = document.getElementById("stepBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resetBtn = document.getElementById("resetBtn");
const speedSlider = document.getElementById("speedSlider");
const speedValue = document.getElementById("speedValue");
const outputSpan = document.getElementById("output");
const tapeDiv = document.getElementById("tape");
const programDisplay = document.getElementById("programDisplay");

let screwtape = null;
let isRunning = false;
let stepInterval = null;
let delay = parseInt(speedSlider.value); // current delay in ms

////////////////////////////////////////
// Tape Node: doubly linked list
////////////////////////////////////////
class TapeNode {
  constructor(value = 0) {
    this.value = value; // stored as a 32-bit signed integer
    this.left = null;
    this.right = null;
  }
}

////////////////////////////////////////
// ScrewtapeInterpreter
////////////////////////////////////////
class ScrewtapeInterpreter {
  constructor(program) {
    this.program = program;
    this.ip = 0; // instruction pointer
    this.output = "";
    this.terminated = false;

    // Build bracket map: for each ']', store matching '['
    this.bracketMap = this.buildBracketMap(program);

    // Set up tape: start with one node of value 0.
    this.currentNode = new TapeNode(0);
    this.currentNode.id = "node0";
    this.nodeCount = 1;
    this.leftmostNode = this.currentNode;
    this.rightmostNode = this.currentNode;
  }

  buildBracketMap(program) {
    let stack = [];
    let map = {};
    for (let i = 0; i < program.length; i++) {
      if (program[i] === "[") {
        stack.push(i);
      } else if (program[i] === "]") {
        if (stack.length > 0) {
          let openIndex = stack.pop();
          map[i] = openIndex;
        }
      }
    }
    return map;
  }

  step() {
    if (this.ip < 0 || this.ip >= this.program.length) {
      this.terminated = true;
      return;
    }
    const instr = this.program[this.ip];

    switch (instr) {
      case "+":
        // Increment using 32-bit signed arithmetic.
        this.currentNode.value = (this.currentNode.value + 1) | 0;
        break;
      case "-":
        // Decrement using 32-bit signed arithmetic.
        this.currentNode.value = (this.currentNode.value - 1) | 0;
        break;
      case ">":
        if (!this.currentNode.right) {
          let newNode = new TapeNode(0);
          newNode.id = "node" + this.nodeCount++;
          newNode.left = this.currentNode;
          this.currentNode.right = newNode;
          if (this.currentNode === this.rightmostNode) {
            this.rightmostNode = newNode;
          }
        }
        this.currentNode = this.currentNode.right;
        break;
      case "<":
        if (!this.currentNode.left) {
          let newNode = new TapeNode(0);
          newNode.id = "node" + this.nodeCount++;
          newNode.right = this.currentNode;
          this.currentNode.left = newNode;
          if (this.currentNode === this.leftmostNode) {
            this.leftmostNode = newNode;
          }
        }
        this.currentNode = this.currentNode.left;
        break;
      case ".":
        // When printing, we use formatChar to display nonprinting characters.
        let charCode = this.currentNode.value;
        this.output += formatChar(charCode);
        break;
      case "[":
        // '[' is a no-op in Screwtape.
        break;
      case "]":
        if (this.currentNode.value !== 0) {
          let matchIndex = this.bracketMap[this.ip];
          if (matchIndex !== undefined) {
            this.ip = matchIndex;
            return; // Skip the ip++ below.
          }
        }
        break;
      default:
        break;
    }
    this.ip++;
    if (this.ip < 0 || this.ip >= this.program.length) {
      this.terminated = true;
    }
  }

  runStep() {
    if (!this.terminated) this.step();
  }
}

////////////////////////////////////////
// Helper: Format character output
////////////////////////////////////////
function formatChar(code) {
  // For printing, only printable ASCII (32..126) are output directly.
  // Otherwise, we return a symbolic representation.
  if (code >= 32 && code <= 126) {
    return String.fromCharCode(code);
  }
  switch (code) {
    case 0: return '<span class="nonprint">&lt;NUL&gt;</span>';
    case 7: return '<span class="nonprint">&lt;BEL&gt;</span>';
    case 8: return '<span class="nonprint">&lt;BS&gt;</span>';
    case 9: return '<span class="nonprint">&lt;TAB&gt;</span>';
    case 10: return '<span class="nonprint">&lt;LF&gt;</span>';
    case 13: return '<span class="nonprint">&lt;CR&gt;</span>';
    default: return `<span class="nonprint">&lt;${code}&gt;</span>`;
  }
}

////////////////////////////////////////
// Visualization Functions
////////////////////////////////////////
function render(interp) {
  outputSpan.innerHTML = interp.output;
  updateProgramDisplay(interp);
  renderTape(interp);
}

function renderTape(interp) {
  tapeDiv.innerHTML = "";
  let nodes = [];
  let cur = interp.leftmostNode;
  while (cur) {
    nodes.push(cur);
    if (cur === interp.rightmostNode) break;
    cur = cur.right;
  }
  for (let node of nodes) {
    let div = document.createElement("div");
    div.className = "tape-cell";
    if (node === interp.currentNode) div.classList.add("current");
    div.textContent = node.value;
    tapeDiv.appendChild(div);
  }
}

function updateProgramDisplay(interp) {
  let prog = interp.program;
  let html = "";
  for (let i = 0; i < prog.length; i++) {
    let ch = prog[i];
    if (i === interp.ip) {
      html += `<span class="current-instr">${ch}</span>`;
    } else {
      html += ch;
    }
  }
  programDisplay.innerHTML = html;
}

////////////////////////////////////////
// Control Functions
////////////////////////////////////////
function reset() {
  if (stepInterval) clearInterval(stepInterval);
  stepInterval = null;
  isRunning = false;
  delay = parseInt(speedSlider.value);
  const program = programInput.value;
  screwtape = new ScrewtapeInterpreter(program);
  render(screwtape);
}

function stepExecution() {
  screwtape.runStep();
  render(screwtape);
}

function runExecution() {
  if (isRunning) return;
  isRunning = true;
  stepInterval = setInterval(() => {
    stepExecution();
    if (screwtape.terminated) {
      pauseExecution();
    }
  }, delay);
}

function pauseExecution() {
  isRunning = false;
  if (stepInterval) {
    clearInterval(stepInterval);
    stepInterval = null;
  }
}

////////////////////////////////////////
// Speed Slider: update delay based on slider value
////////////////////////////////////////
speedSlider.addEventListener("input", () => {
  delay = parseInt(speedSlider.value);
  speedValue.textContent = delay;
  if (isRunning) {
    clearInterval(stepInterval);
    stepInterval = setInterval(() => {
      stepExecution();
      if (screwtape.terminated) {
        pauseExecution();
      }
    }, delay);
  }
});

// Wire up buttons
runBtn.addEventListener("click", runExecution);
stepBtn.addEventListener("click", stepExecution);
pauseBtn.addEventListener("click", pauseExecution);
resetBtn.addEventListener("click", reset);

// Initial reset on page load
reset();
