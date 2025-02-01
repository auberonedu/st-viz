/**
 * Screwtape Visualizer
 *  - Modified BF (Screwtape): no forward jumps on '['; ']' jumps back if current cell != 0.
 *  - Memory is a doubly linked list that grows as needed.
 *  - Cells are treated as unsigned ints.
 *  - Non-printing characters are displayed as symbolic spans.
 *  - Program text is visualized with the current instruction bold and red.
 */

const programInput = document.getElementById("program");
const runBtn = document.getElementById("runBtn");
const stepBtn = document.getElementById("stepBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resetBtn = document.getElementById("resetBtn");
const outputSpan = document.getElementById("output");
const tapeDiv = document.getElementById("tape");
const programDisplay = document.getElementById("programDisplay");

let screwtape = null;
let isRunning = false;
let stepInterval = null;

////////////////////////////////////////
// Tape Node (Doubly Linked List)
////////////////////////////////////////
class TapeNode {
  constructor(value = 0) {
    this.value = value;
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

    // Precompute bracket map: for each ']', store its matching '['
    this.bracketMap = this.buildBracketMap(program);

    // Tape: start with one node (value=0)
    this.currentNode = new TapeNode(0);
    this.currentNode.id = "node0";
    this.nodeCount = 1;
    this.leftmostNode = this.currentNode;
    this.rightmostNode = this.currentNode;

    this.terminated = false;
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
        this.currentNode.value++;
        break;
      case "-":
        if (this.currentNode.value > 0) {
          this.currentNode.value--;
        }
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
        // When printing, check if the cell's value is a printable character.
        let charCode = this.currentNode.value;
        this.output += formatChar(charCode);
        break;
      case "[":
        // '[' is a no-op; it's only used as a marker for jumps.
        break;
      case "]":
        if (this.currentNode.value !== 0) {
          const match = this.bracketMap[this.ip];
          if (match !== undefined) {
            this.ip = match;
            return;
          }
        }
        break;
      default:
        // Ignore unknown instructions
        break;
    }
    this.ip++;
    if (this.ip < 0 || this.ip >= this.program.length) {
      this.terminated = true;
    }
  }

  runStep() {
    if (!this.terminated) {
      this.step();
    }
  }
}

////////////////////////////////////////
// Helper: Format a character for output
////////////////////////////////////////
function formatChar(code) {
  // Printable ASCII: 32 to 126
  if (code >= 32 && code <= 126) {
    return String.fromCharCode(code);
  }
  // Map some common nonprintables:
  switch (code) {
    case 0: return '<span class="nonprint">&lt;NUL&gt;</span>';
    case 7: return '<span class="nonprint">&lt;BEL&gt;</span>';
    case 8: return '<span class="nonprint">&lt;BS&gt;</span>';
    case 9: return '<span class="nonprint">&lt;TAB&gt;</span>';
    case 10: return '<span class="nonprint">&lt;LF&gt;</span>';
    case 13: return '<span class="nonprint">&lt;CR&gt;</span>';
    default:
      return `<span class="nonprint">&lt;${code}&gt;</span>`;
  }
}

////////////////////////////////////////
// Visualization: Rendering Tape, Program, and Output
////////////////////////////////////////
function render(interp) {
  // Update output using innerHTML so formatting shows
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
    if (node === interp.currentNode) {
      div.classList.add("current");
    }
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
  let program = programInput.value;
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
  }, 300);
}

function pauseExecution() {
  isRunning = false;
  if (stepInterval) {
    clearInterval(stepInterval);
    stepInterval = null;
  }
}

// Wire up buttons
runBtn.addEventListener("click", runExecution);
stepBtn.addEventListener("click", stepExecution);
pauseBtn.addEventListener("click", pauseExecution);
resetBtn.addEventListener("click", reset);

// On load, do initial reset
reset();
