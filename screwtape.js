const programInput    = document.getElementById("program");
const runBtn          = document.getElementById("runBtn");
const stepBtn         = document.getElementById("stepBtn");
const pauseBtn        = document.getElementById("pauseBtn");
const resetBtn        = document.getElementById("resetBtn");
const loadProgramBtn  = document.getElementById("loadProgramBtn");
const speedSlider     = document.getElementById("speedSlider");
const speedValue      = document.getElementById("speedValue");
const outputSpan      = document.getElementById("output");
const tapeDiv         = document.getElementById("tape");
const programDisplay  = document.getElementById("programDisplay");
const addLeftBtn      = document.getElementById("addLeftBtn");
const addRightBtn     = document.getElementById("addRightBtn");

let screwtape    = null;
let isRunning    = false;
let stepInterval = null;
let delay        = parseInt(speedSlider.value, 10);

class TapeNode {
  constructor(value = 0) {
    this.value = value;
    this.left = null;
    this.right = null;
  }
}

class ScrewtapeInterpreter {
  constructor(program) {
    this.program      = program;
    this.ip           = 0;
    this.output       = "";
    this.terminated   = false;
    this.bracketMap   = this.buildBracketMap(program);
    this.currentNode  = new TapeNode(0);
    this.currentNode.id = "node0";
    this.nodeCount    = 1;
    this.leftmostNode = this.currentNode;
    this.rightmostNode= this.currentNode;
  }

  buildBracketMap(prog) {
    let stack = [], map = {};
    for (let i = 0; i < prog.length; i++) {
      if (prog[i] === "[")       stack.push(i);
      else if (prog[i] === "]") {
        if (stack.length) map[i] = stack.pop();
      }
    }
    return map;
  }

  addCellLeft() {
    const newNode = new TapeNode(0);
    newNode.id = "node" + this.nodeCount++;
    this.leftmostNode.left = newNode;
    newNode.right = this.leftmostNode;
    this.leftmostNode = newNode;
  }

  addCellRight() {
    const newNode = new TapeNode(0);
    newNode.id = "node" + this.nodeCount++;
    this.rightmostNode.right = newNode;
    newNode.left = this.rightmostNode;
    this.rightmostNode = newNode;
  }

  loadProgramToTape() {
    const mapping = {">":1,"<":2,"+":3,"-":4,"[":5,"]":6,".":7};
    const codes = [];
    for (const ch of this.program) {
      if (mapping[ch] !== undefined) codes.push(mapping[ch]);
    }
    if (!codes.length) return;
    // rebuild tape from codes
    this.nodeCount = 1;
    const first = new TapeNode(codes[0]);
    first.id = "node0";
    this.leftmostNode = first;
    let prev = first;
    for (let i = 1; i < codes.length; i++) {
      const node = new TapeNode(codes[i]);
      node.id = "node" + this.nodeCount++;
      prev.right = node;
      node.left = prev;
      prev = node;
    }
    this.rightmostNode = prev;
    this.currentNode = this.leftmostNode;
  }

  step() {
    if (this.ip < 0 || this.ip >= this.program.length) {
      this.terminated = true;
      return;
    }
    const instr = this.program[this.ip];
    switch (instr) {
      case "+": this.currentNode.value = (this.currentNode.value + 1) | 0; break;
      case "-": this.currentNode.value = (this.currentNode.value - 1) | 0; break;
      case ">":
        if (!this.currentNode.right) {
          const n = new TapeNode(0);
          n.id = "node" + this.nodeCount++;
          n.left = this.currentNode;
          this.currentNode.right = n;
          this.rightmostNode = n;
        }
        this.currentNode = this.currentNode.right;
        break;
      case "<":
        if (!this.currentNode.left) {
          const n = new TapeNode(0);
          n.id = "node" + this.nodeCount++;
          n.right = this.currentNode;
          this.currentNode.left = n;
          this.leftmostNode = n;
        }
        this.currentNode = this.currentNode.left;
        break;
      case ".": this.output += formatChar(this.currentNode.value); break;
      case "]":
        if (this.currentNode.value !== 0) {
          const mi = this.bracketMap[this.ip];
          if (mi !== undefined) {
            this.ip = mi;
            return;
          }
        }
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

function formatChar(code) {
  if (code >= 32 && code <= 126) return String.fromCharCode(code);
  switch (code) {
    case 0:  return '<span class="nonprint">&lt;NUL&gt;</span>';
    case 7:  return '<span class="nonprint">&lt;BEL&gt;</span>';
    case 8:  return '<span class="nonprint">&lt;BS&gt;</span>';
    case 9:  return '<span class="nonprint">&lt;TAB&gt;</span>';
    case 10: return '<span class="nonprint">&lt;LF&gt;</span>';
    case 13: return '<span class="nonprint">&lt;CR&gt;</span>';
    default: return `<span class="nonprint">&lt;${code}&gt;</span>`;
  }
}

function render(interp) {
  outputSpan.innerHTML = interp.output;
  updateProgramDisplay(interp);
  renderTape(interp);
}

function renderTape(interp) {
  tapeDiv.innerHTML = "";
  const nodes = [];
  let cur = interp.leftmostNode;
  while (cur) {
    nodes.push(cur);
    if (cur === interp.rightmostNode) break;
    cur = cur.right;
  }
  for (const node of nodes) {
    const div = document.createElement("div");
    div.className = "tape-cell";
    if (node === interp.currentNode) div.classList.add("current");
    div.contentEditable = !isRunning;
    div.spellcheck = false;
    div.textContent = node.value;
    div.addEventListener("blur", () => {
      const num = parseInt(div.textContent, 10);
      node.value = Number.isNaN(num) ? 0 : (num | 0);
      render(interp);
    });
    div.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        e.preventDefault();
        div.blur();
      }
    });
    tapeDiv.appendChild(div);
  }
}

function updateProgramDisplay(interp) {
  let html = "";
  for (let i = 0; i < interp.program.length; i++) {
    html += i === interp.ip
         ? `<span class="current-instr">${interp.program[i]}</span>`
         : interp.program[i];
  }
  programDisplay.innerHTML = html;
}

function reset() {
  if (stepInterval) clearInterval(stepInterval);
  isRunning = false;
  delay = parseInt(speedSlider.value, 10);
  screwtape = new ScrewtapeInterpreter(programInput.value);
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
    if (screwtape.terminated) pauseExecution();
  }, delay);
}

function pauseExecution() {
  isRunning = false;
  if (stepInterval) {
    clearInterval(stepInterval);
    stepInterval = null;
  }
}

speedSlider.addEventListener("input", () => {
  delay = parseInt(speedSlider.value, 10);
  speedValue.textContent = delay;
  if (isRunning) {
    clearInterval(stepInterval);
    stepInterval = setInterval(() => {
      stepExecution();
      if (screwtape.terminated) pauseExecution();
    }, delay);
  }
});

runBtn.addEventListener("click", runExecution);
stepBtn.addEventListener("click", stepExecution);
pauseBtn.addEventListener("click", pauseExecution);
resetBtn.addEventListener("click", reset);

loadProgramBtn.addEventListener("click", () => {
  if (!isRunning && screwtape) {
    screwtape.loadProgramToTape();
    render(screwtape);
  }
});

addLeftBtn.addEventListener("click", () => {
  if (!isRunning && screwtape) {
    screwtape.addCellLeft();
    render(screwtape);
  }
});
addRightBtn.addEventListener("click", () => {
  if (!isRunning && screwtape) {
    screwtape.addCellRight();
    render(screwtape);
  }
});

// initialize
reset();
