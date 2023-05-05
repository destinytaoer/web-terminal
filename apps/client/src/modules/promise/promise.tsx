import { useEffect } from 'react'
import { Scheduler } from 'scheduler'

export function PromisePage() {
  useEffect(() => {
    // const scheduler = new Scheduler()
    // const timeout = (time) =>
    //   new Promise((resolve) => {
    //     setTimeout(resolve, time)
    //   })
    //
    // const addTask = (time, order) => {
    //   scheduler.add(() => timeout(time)).then(() => console.log(order))
    // }
    //
    // addTask(1000, '1')
    // addTask(500, '2')
    // addTask(300, '3')
    // addTask(400, '4')
    //
    // return () => {
    //   scheduler.clear()
    // }
  }, [])

  return <div>promise</div>
}
