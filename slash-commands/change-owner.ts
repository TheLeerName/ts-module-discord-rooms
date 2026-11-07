import Core from "../../../index.js";
import { SlashCommand } from "../../discord/index.js";
import Module from "../index.js";

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
			guild: `${interaction.guild.name} (${interaction.guild.id})`,
			user: `${interaction.user.username} (${interaction.user.id})`
		};
		try {
			const newOwner = interaction.options.getUser("new-owner", true);
			args.newOwner = newOwner;

			const guildData = Module.data.getGuild(interaction.guild.id);

			if (!guildData.enabled)
				throw new Error("Канал-категория ещё не была создана!");

			if (!interaction.member.voice)
				throw new Error("Вы не находитесь в голосовом канале!");

			const roomData = guildData.roomsByVoiceChannelID.get(interaction.member.voice.id);
			if (!roomData)
				throw new Error("Голосовой канал в котором вы находитесь не является комнатой!");

			if (roomData.owner.id === interaction.user.id)
				throw new Error("Вы не владелец комнаты!");

			const member = await interaction.guild.members.fetch(newOwner);
			const oldOwner = roomData.owner;
			await Module.changeRoomOwner(roomData, member);

			guildData.enabled = true;
			await Module.data.save();

			await interaction.editReply({embeds: [new Discord.EmbedBuilder()
				.setTitle(`:white_check_mark: Успешно!`)
				.setFields(
					{
						name: "Предыдущий владелец комнаты",
						value: `<@${oldOwner.id}>`
					},
					{
						name: "Новый владелец комнаты",
						value: `<@${roomData.owner.id}>`
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