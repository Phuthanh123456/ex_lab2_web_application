import { createElement, mountApp, useState } from './reactive-engine.js';

const root = document.getElementById('app');
if (root === null) {
  throw new Error('Cannot mount Exercise 2: #app was not found.');
}

let nextTaskId = 3;

function TaskManager() {
  const [tasks, setTasks] = useState([
    { id: 'task-review-pr', text: 'Review PR', completed: false },
    { id: 'task-verify-ast', text: 'Verify AST', completed: false },
  ]);
  const [filter, setFilter] = useState('ALL');

  function addTask() {
    const taskNumber = nextTaskId;
    nextTaskId += 1;

    setTasks((currentTasks) => [
      ...currentTasks,
      {
        id: `task-${taskNumber}`,
        text: `Task ${taskNumber}`,
        completed: false,
      },
    ]);
  }

  function toggleTask(taskId) {
    setTasks((currentTasks) => currentTasks.map((task) => (
      task.id === taskId
        ? { ...task, completed: !task.completed }
        : task
    )));
  }

  const visibleTasks = tasks.filter((task) => {
    if (filter === 'ACTIVE') return !task.completed;
    if (filter === 'COMPLETED') return task.completed;
    return true;
  });

  const filterOptions = [
    { value: 'ALL', label: 'All' },
    { value: 'ACTIVE', label: 'Active' },
    { value: 'COMPLETED', label: 'Completed' },
  ];

  return createElement('main', { id: 'task-manager' },
    createElement('header', null,
      createElement('h1', null, 'Task Manager'),
      createElement('p', null, `Total tasks: ${tasks.length}`),
      createElement('button', { id: 'add-task', onClick: addTask }, 'Add Task')
    ),
    createElement('section', { id: 'task-filters', role: 'group' },
      createElement('h2', null, 'Filter tasks'),
      ...filterOptions.map((option) => createElement('button', {
        id: `filter-${option.value.toLowerCase()}`,
        className: filter === option.value ? 'selected' : '',
        onClick: () => setFilter(option.value),
      }, option.label))
    ),
    createElement('section', { id: 'task-list' },
      createElement('h2', null, `${filterOptions.find((option) => option.value === filter).label} tasks`),
      createElement('ul', null,
        ...(visibleTasks.length > 0
          ? visibleTasks.map((task) => createElement('li', { id: task.id },
            createElement('span', null, `${task.text} — ${task.completed ? 'Completed' : 'Active'}`),
            createElement('button', {
              id: `toggle-${task.id}`,
              onClick: () => toggleTask(task.id),
            }, task.completed ? 'Mark active' : 'Mark complete')
          ))
          : [createElement('li', { id: 'empty-task-list' }, 'No tasks in this filter.')])
      )
    )
  );
}

mountApp(TaskManager, root);
