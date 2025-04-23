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
const addLeftBtn = document.getElementById("addLeftBtn");
const addRightBtn = document.getElementById("addRightBtn");

let screwtape = null;
let isRunning = false;
let stepInterval = null;
let delay = parseInt(speedSlider.value);

class TapeNode {
  constructor(value = 0) {
    this.value = value;
    this.left = null;
    this.right = null;
  }
}

class ScrewtapeInterpreter {
  constructor(program) {
    this.program = program;
    this.ip = 0;
    this.output = "";
    this.terminated = false;
    this.bracketMap = this.buildBracketMap(program);
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

  step() {
    if (this.ip < 0 || this.ip >= this.program.length) {
      this.terminated = true;
      return;
    }
    const instr = this.program[this.ip];
    switch (instr) {
      case "+":
        this.currentNode.value = (this.currentNode.value + 1) | 0;
        break;
      case "-":
        this.currentNode.value = (this.currentNode.value - 1) | 0;
        break;
      case ">":
        if (!this.currentNode.right) {
          const newNode = new TapeNode(0);
          newNode.id = "node" + this.nodeCount++;
          newNode.left = this.currentNode;
          this.currentNode.right = newNode;
          this.rightmostNode = newNode;
        }
        this.currentNode = this.currentNode.right;
        break;
      case "<":
        if (!this.currentNode.left) {
          const newNode = new TapeNode(0);
          newNode.id = "node" + this.nodeCount++;
          newNode.right = this.currentNode;
          this.currentNode.left = newNode;
          this.leftmostNode = newNode;
        }
        this.currentNode = this.currentNode.left;
        break;
      case ".":
        this.output += formatChar(this.currentNode.value);
        break;
      case "]":
        if (this.currentNode.value !== 0) {
          const matchIndex = this.bracketMap[this.ip];
          if (matchIndex !== undefined) {
            this.ip = matchIndex;
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
    case 0: return '<span class="nonprint">&lt;NUL&gt;</span>';
    case 7: return '<span class="nonprint">&lt;BEL&gt;</span>';
    case 8: return '<span class="nonprint">&lt;BS&gt;</span>';
    case 9: return '<span class="nonprint">&lt;TAB&gt;</span>';
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
  let nodes = [];
  let cur = interp.leftmostNode;
  while (cur) {
    nodes.push(cur);
    if (cur === interp.rightmostNode) break;
    cur = cur.right;
  }
  for (let node of nodes) {
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
  const prog = interp.program;
  let html = "";
  for (let i = 0; i < prog.length; i++) {
    html += i === interp.ip
      ? `<span class="current-instr">${prog[i]}</span>`
      : prog[i];
  }
  programDisplay.innerHTML = html;
}

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
  delay = parseInt(speedSlider.value);
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

reset();
