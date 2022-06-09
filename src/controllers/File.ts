import { NextFunction, Request, Response } from "express";
import { Blob } from "node:buffer";
import { Readable } from "stream";
import FileManagement from "../core/FileManagement";
import { FileMetadata } from "../models/FileMetadata";
import { Trip } from "../models/Trip";
import InvalidBodyError from "../types/errors/InvalidBodyError";
import { FileMetadataInput, isFileMetadataInput } from "../types/models/File";
import { generateTempFileId, getBucketPrefix } from "../utils/File";


export async function uploadFile(request: Request, response: Response, next: NextFunction) {
	const trip: Trip = response.locals.trip;
	const files = request.files?.file;

	if(Array.isArray(files) || files === undefined)
		return next({ message: "Only one file at the time", code: 400, name: "InvalidBodyError" } as InvalidBodyError);

	const metadata: FileMetadataInput = {
		mimeType: files.mimetype,
		tripId: trip.id,
		...request.body
	};
	
	if(!isFileMetadataInput(metadata))
		return next({ message: "Invalid body error", code: 400, name: "InvalidBodyError" } as InvalidBodyError);

	const fileMetadata = await FileMetadata.create(metadata);

	const bucketPrefix = getBucketPrefix();

	await FileManagement.get().uploadFile(fileMetadata, `${bucketPrefix}-${trip.id}-${trip.name.replaceAll(" ", "-").toLowerCase()}`, files.data);

	const tempFileId = await generateTempFileId(fileMetadata.id);

	if(tempFileId)
		fileMetadata.tempFileId = tempFileId;

	response.json(fileMetadata);
}

export async function getFileMetadata(request: Request, response: Response) {
	const metadata = response.locals.fileMetadata;

	const tempFileId = await generateTempFileId(metadata.id);

	if(tempFileId)
		metadata.tempFileId = tempFileId;

	response.json(metadata);
}

export async function getFile(request: Request, response: Response) {
	const metadata: FileMetadata = response.locals.fileMetadata;
	const trip = await Trip.findByPk(metadata.tripId);

	if(!trip)
		throw new Error("Wtf y'a po de trip");

	const bucketPrefix = getBucketPrefix();

	const res = await FileManagement.get().getFile(metadata.id.toString(), `${bucketPrefix}-${trip.id}-${trip.name.replaceAll(" ", "-").toLowerCase()}`);

	let fileData: Buffer;

	if(res.Body instanceof Blob) {
		fileData = Buffer.from(await res.Body.arrayBuffer());
	}
	else if(res.Body instanceof Readable) {
		fileData = await new Promise((resolve, reject) => {
			
			const bufs: Buffer[] = [];

			(res.Body as Readable).on("data", data => { bufs.push(data); });

			(res.Body as Readable).on("end", () => {
				resolve(Buffer.concat(bufs));
			});

			(res.Body as Readable).on("error", err => {
				reject(err);
			});
		});
	}
	else {
		fileData = Buffer.from(res.Body as Buffer | Uint8Array | string);
	}

	response.setHeader("Content-Type", metadata.mimeType);
	response.setHeader("Content-Length", fileData.length);

	response.status(200).send(fileData);
}

export async function getTripFiles(request: Request, response: Response) {
	const metadatas = await FileMetadata.findAll({
		where: {
			tripId: response.locals.trip.id
		}
	});

	for(let i = 0; i < metadatas.length; i++) {
		const tempFileId = await generateTempFileId(metadatas[i].id);

		if(tempFileId)
			metadatas[i].tempFileId = tempFileId;	
	}

	response.json(metadatas);
}

export async function updateMetadata(request: Request, response: Response) {
	const metadata: FileMetadata = response.locals.fileMetadata;
	const newAttributes: Partial<FileMetadata> = request.body;

	if(newAttributes.visibility) {
		newAttributes.tempFileId = "";
	}

	const meta = await metadata.update(newAttributes);

	const tempFileId = await generateTempFileId(meta.id);

	if(tempFileId)
		meta.tempFileId = tempFileId;

	response.json(meta);
}

export async function deleteFile(request: Request, response: Response) {
	const metadata: FileMetadata = response.locals.fileMetada;
	const trip: Trip = response.locals.trip;
	const bucketPrefix = getBucketPrefix();
	
	await FileManagement.get().deleteFile(metadata.id.toString(), `${bucketPrefix}-${trip.id}-${trip.name.replaceAll(" ", "-").toLowerCase()}`);

	await FileMetadata.destroy();

	response.json({ message: "File deleted" });
}