import { DiscordRoomsModule as Module } from "./index.js";
import { BaseData } from "../../data.js";

export default class Data extends BaseData {
	/** If this `true`, next call of {@link save()} will save data */
	needsSave = false;

	protected module: Module;

	initialize() {
		const json = this.getSavedFields();
		this.needsSave = true;

		this.needsSave = !this.registerFieldArray(json, "guilds",
			savedValue => this.module.guilds.fromJSON(savedValue),
			() => this.module.guilds.toJSON(),
		);

		this.save();
		return this;
	}

	async save(force?: boolean) {
		if (force || this.needsSave) {
			await super.save();
			this.needsSave = false;
		}
	}
}