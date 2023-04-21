const Koa = require("koa");
const Router = require("@koa/router");
const cors = require("@koa/cors");
const { createServer } = require("http");

const app = new Koa();
const router = new Router();

// 跨域
app.use(cors());
app.use(router.routes()).use(router.allowedMethods());

const httpServer = createServer(app.callback());

httpServer.listen(3001);
