/**
 * Screwtape Visualizer
 *  - No forward jumps on '['
 *  - ']' jumps back to matching '[' if cell != 0
 *  - Tape is infinite in both directions; we model it with a doubly linked list structure
 *  - Cells store "unsigned int" in principle, but we store in JS number
 *  - No input instructions
 *  - We'll animate each step
 */

const programInput = document.getElementById("program");
const runBtn = document.getElementById("runBtn");
const stepBtn = document.getElementById("stepBtn");
const pauseBtn = document.getElementById("pauseBtn");
const resetBtn = document.getElementById("resetBtn");
const outputSpan = document.getElementById("output");
const tapeDiv = document.getElementById("tape");
const instrPointerSpan = document.getElementById("instrPointer");

let screwtape = null;
let isRunning = false;
let stepInterval = null;

////////////////////////////////////////
// A Node in the doubly linked list
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

    // We'll precompute bracket pairs for jumping back.
    // For "modified BF", '[' is no-op, ']' jumps back to matching '[' if cell != 0
    // We'll just store a stack of [ positions
    // then for each ']' we know the matching '['
    // This helps us jump back quickly.
    this.bracketMap = this.buildBracketMap(program);

    // We'll represent the tape as a doubly linked list.
    // Start with a single node of value=0
    this.currentNode = new TapeNode(0);
    
    // We'll keep an ID for each node so we can display them in a stable order
    this.currentNode.id = "node0";
    this.nodeCount = 1;

    // We'll store references to each node in a map, keyed by ID => node
    this.nodesById = { node0: this.currentNode };

    // For visualization, let's store the "center" node as currentNode, but we can expand left or right as needed
    // We'll keep a pointer so we can do a BFS or linear list for display
    this.leftmostNode = this.currentNode;
    this.rightmostNode = this.currentNode;

    // Execution done?
    this.terminated = false;
  }

  buildBracketMap(program) {
    // For standard BF we'd build pairs. But here, '[' doesn't skip forward; ']' does a jump back.
    // We'll just track each ']' to its matching '[' from left to right.
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
    // any leftover '[' don't matter if unmatched
    return map;
  }

  step() {
    if (this.terminated) return;

    if (this.ip < 0 || this.ip >= this.program.length) {
      // done
      this.terminated = true;
      return;
    }
    let instr = this.program[this.ip];

    switch (instr) {
      case "+":
        this.currentNode.value++;
        break;
      case "-":
        if (this.currentNode.value > 0) {
          this.currentNode.value--;
        } else {
          // if truly infinite unsigned, we'd do a huge wrap. We'll skip wrap for simplicity
        }
        break;
      case ">":
        // move pointer right
        if (!this.currentNode.right) {
          // create new node
          let newNode = new TapeNode(0);
          newNode.id = "node" + this.nodeCount++;
          newNode.left = this.currentNode;
          this.currentNode.right = newNode;
          // update rightmost
          if (this.currentNode === this.rightmostNode) {
            this.rightmostNode = newNode;
          }
        }
        this.currentNode = this.currentNode.right;
        break;
      case "<":
        // move pointer left
        if (!this.currentNode.left) {
          // create new node on the left
          let newNode = new TapeNode(0);
          newNode.id = "node" + this.nodeCount++;
          newNode.right = this.currentNode;
          this.currentNode.left = newNode;
          // update leftmost
          if (this.currentNode === this.leftmostNode) {
            this.leftmostNode = newNode;
          }
        }
        this.currentNode = this.currentNode.left;
        break;
      case ".":
        // output
        let charCode = this.currentNode.value;
        // clamp for display? We'll assume ASCII
        if (charCode < 256) {
          this.output += String.fromCharCode(charCode);
        } else {
          // ignoring large values
          this.output += "?";
        }
        break;
      case "[":
        // in "Screwtape," '[' is a no-op, just a marker for jump back
        // we do nothing here
        break;
      case "]":
        // jump back to matching '[' if current cell != 0
        if (this.currentNode.value !== 0) {
          let matchIndex = this.bracketMap[this.ip];
          if (matchIndex !== undefined) {
            this.ip = matchIndex;
            return; // so we skip the ip++ below
          }
        }
        break;
      default:
        // ignore unrecognized instructions
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
// Managing the Visualization
////////////////////////////////////////

function render(interp) {
  // Render output
  outputSpan.textContent = interp.output;

  // Render instruction pointer
  if (interp.terminated) {
    instrPointer.textContent = "(Terminated)";
  } else {
    instrPointer.textContent = interp.ip + "/" + interp.program.length;
  }

  // Render tape
  renderTape(interp);
}

function renderTape(interp) {
  tapeDiv.innerHTML = "";

  // gather nodes from left to right
  let nodes = [];
  let cur = interp.leftmostNode;
  while (cur) {
    nodes.push(cur);
    if (cur === interp.rightmostNode) break;
    cur = cur.right;
  }

  // produce a little div for each
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
  }, 300); // step every 300ms
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
