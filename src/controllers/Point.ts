import { NextFunction, Request, Response } from "express";
import { ValidationError } from "sequelize";
import { Day } from "../models/Day";
import { FileMetadata } from "../models/FileMetadata";
import { Point } from "../models/Point";
import InvalidBodyError from "../types/errors/InvalidBodyError";
import { isPointInput } from "../types/models/Point";

export async function getPointsByTrip(request: Request, response: Response) {
	const points = await Point.findAll({
		where: {
			tripId: response.locals.trip.id
		}
	});

	response.json(points);
}

export async function getPointsByStep(request: Request, response: Response) {
	const points = await Point.findAll({
		where: {
			stepId: response.locals.step.id
		}
	});

	response.json(points);
}

export async function getPointsByDay(request: Request, response: Response) {
	const points = await (response.locals.day as Day).getPoints();
	
	response.json(points);
}

export async function addPoint(request: Request, response: Response, next: NextFunction) {

	const input = {
		authorId: response.locals.user.id,
		tripId: response.locals.trip.id,
		...request.body
	};

	const daysId: number[] | undefined = input.daysId;

	if(!isPointInput(input)) {
		next({ message: "Invalid request body", code: 400, name: "InvalidBodyError" } as InvalidBodyError);
		return;
	}

	let point;

	try {
		point = await Point.create(input);
	}
	catch(error) {
		if(error instanceof ValidationError)
			return next({ message: error.message, code: 400, name: "InvalidBodyError" } as InvalidBodyError);
		
		return next(error);
	}

	if(daysId && Array.isArray(daysId)) {		
		await point.addDays(daysId);	
	}
	
	response.json(point);
}

export async function removePoint(request: Request, response: Response) {

	const point = response.locals.point;

	await point.destroy();

	response.json({ message: "Point deleted" });
}

export async function updatePoint(request: Request, response: Response, next: NextFunction) {
	
	const point: Point = response.locals.point;
	const newAttributes: Partial<Point> = request.body;

	try {
		await point.update(newAttributes);
	}
	catch(error) {
		if(error instanceof ValidationError)
			return next({ message: error.message, code: 400, name: "InvalidBodyError" } as InvalidBodyError);
		
		return next(error);
	}

	return response.json(point);
}

export async function getPointFiles(request: Request, response: Response) {
	const point: Point = response.locals.point;

	const files = await FileMetadata.findAll({
		where: {
			pointId: point.id
		}
	});

	response.json(files);
}