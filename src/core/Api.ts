import express from "express";
import cors from "cors";
import fileUpload from "express-fileupload";
import router from "../routes";
import Loggers from "./Logger";

const app = express();
app.use(cors({
	exposedHeaders: ["X-Renewed-JWT-Token"],
	origin: "*"
}));
app.use(fileUpload());
app.use(express.json({
	limit: "1000mb"
}));
app.use(express.urlencoded({ extended: false }));

app.use("/", router);

app.listen(process.env.API_PORT ?? 3000, () => Loggers.getLogger("api").info(`Listening to port ${process.env.API_PORT ?? 3000}`));

export default app;