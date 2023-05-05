export class Scheduler {
  task: Promise<any>[] = []

  constructor() {}

  add(promiseCreator: () => Promise<any>) {
    this.task.push(promiseCreator())
  }

  clear() {}
}
