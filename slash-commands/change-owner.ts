import Core from "../../../index.js";
import Module from "../index.js";
import DiscordModule, { SlashCommand } from "../../discord/index.js";

import * as Discord from "discord.js";

// TODO: make another slash-command which will be used by administrators and will change room owner even if administrator isnt current room owner
export default () => {
	const c = new SlashCommand()
	.setVersion(1)
	.setCooldown(5000)
	.setName("rooms-change-owner")
	.setDescription(`Changes owner of room, where you right now (if you currently owner)`)
	.setDescriptionLocalization("ru", `Передаёт права владельца в комнате, которой вы находитесь (если вы являетесь владельцем)`)
	.setChatInput(async(interaction) => {
		if (!interaction.inCachedGuild()) return;

		const start = Date.now();
		await interaction.deferReply();

		const args: any = {
			guild: DiscordModule.getGuildNameAndID(interaction.guild),
			member: DiscordModule.getGuildMemberNameAndID(interaction.member),
		};
		try {
			const newOwner = interaction.options.getUser("new-owner", true);
			args.newOwner = newOwner;

			if (interaction.member.voice == null)
				throw new Error("Вы не находитесь в голосовом канале!");

			const state = Module.guilds.createAndGet(interaction.guild);
			if (!state.enabled)
				throw new Error("Канал-категория ещё не была создана!");

			const room = state.rooms.get(interaction.member.voice.id);
			if (room == null)
				throw new Error("Голосовой канал в котором вы находитесь не является комнатой!");

			if (room.ownerID === interaction.user.id)
				throw new Error("Вы не владелец комнаты!");

			const oldOwnerID = room.ownerID;
			await room.changeOwner(newOwner.id);

			await Module.data.save(true);

			await interaction.editReply({embeds: [new Discord.EmbedBuilder()
				.setTitle(`:white_check_mark: Успешно!`)
				.setFields(
					{
						name: "Предыдущий владелец комнаты",
						value: `<@${oldOwnerID}>`,
					},
					{
						name: "Новый владелец комнаты",
						value: `<@${room.ownerID}>`,
					}
				)
				.setColor("#77b255")
				.setFooter({text: `Время обработки: ${Core.humanizeDuration(Date.now() - start)}`})
			]});
			Module.log.info(`Command ${interaction.commandName} success`, {args});
		}
		catch(error) {
			await interaction.editReply({embeds: [new Discord.EmbedBuilder()
				.setTitle(`:x: Ошибка!`)
				.setDescription(`\`\`\`\n${error instanceof Error ? error.message : error}\n\`\`\``)
				.setColor("#dd2e44")
				.setFooter({text: `Время обработки: ${Core.humanizeDuration(Date.now() - start)}`})
			]});

			Module.log.error(`Command ${interaction.commandName} failed`, {error, args});
		}
	});
	c.addUserOption(option => option
		.setName("new-owner")
		.setDescription("New owner of room")
		.setDescriptionLocalization("ru", "Новый владелец комнаты")
		.setRequired(true)
	);
	return c;
};