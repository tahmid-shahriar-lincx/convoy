const taskModel = require('../models/task')

module.exports = {
  listTasks,
  saveTask,
  deleteTask,
  updateTask,
  updateTaskKanban,
  getTaskCount,
  getLastTaskSavedDate
}

function listTasks (filters = {}) {
  return taskModel.getTasks(filters)
}

function saveTask (taskData) {
  return taskModel.saveTask(taskData)
}

function deleteTask (taskId) {
  return taskModel.deleteTask(taskId)
}

function updateTask (taskId, taskData) {
  return taskModel.updateTask(taskId, taskData)
}

function updateTaskKanban (taskId, kanbanData) {
  return taskModel.updateTaskKanban(taskId, kanbanData)
}

function getTaskCount () {
  return taskModel.getTaskCount()
}

function getLastTaskSavedDate () {
  return taskModel.getLastTaskSavedDate()
}
