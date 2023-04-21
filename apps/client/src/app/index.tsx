import { ConfigProvider } from 'antd'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'

import zhCN from 'antd/locale/zh_CN'

import './styles/global.css'
import 'antd/dist/reset.css'

const App = () => {
  return (
    <ConfigProvider locale={zhCN}>
      <RouterProvider router={router} />
    </ConfigProvider>
  )
}

export default App
