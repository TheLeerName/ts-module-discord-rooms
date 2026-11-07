import Core from "../../../index.js";
import Module from "../index.js";
import { SlashCommand } from "../../discord/index.js";

import * as Discord from "discord.js";

/** That command name uses for slash command allowing/banning system, if this will be banned on server, module will stop functioning on this server */
export const slashCommandChangeSettingsName = "rooms-change-settings";

export default () => {
	const c = new SlashCommand()
	.setVersion(1)
	.setName(slashCommandChangeSettingsName)
	.setDescription(`Changes some settings for this server`)
	.setDescriptionLocalization("ru", `Изменяет настройки для этого сервера`)
	.setChatInput(async(interaction) => {
		if (!interaction.inCachedGuild()) return;

		const start = Date.now();
		await interaction.deferReply();

		const args: any = {
			guild: `${interaction.guild.name} (${interaction.guild.id})`,
			user: `${interaction.user.username} (${interaction.user.id})`
		};
		try {
			const roomNameTemplate = interaction.options.getString("room-name-template", true);
			args.roomNameTemplate = roomNameTemplate;

			const guildData = Module.data.getGuild(interaction.guild.id);
			guildData.roomVoiceChannelNameTemplate = roomNameTemplate;
			await Module.data.save();

			await interaction.editReply({embeds: [new Discord.EmbedBuilder()
				.setTitle(`:white_check_mark: Успешно!`)
				.setFields(
					{
						name: "Шаблон имени комнаты",
						value: guildData.roomVoiceChannelNameTemplate
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
				.setDescription(`\`\`\`\n${error.message}\n\`\`\``)
				.setColor("#dd2e44")
				.setFooter({text: `Время обработки: ${Core.humanizeDuration(Date.now() - start)}`})
			]});

			Module.log.error(`Command ${interaction.commandName} failed`, {error, args});
		}
	});
	c.addUserOption(option => option
		.setName("room-name-template")
		.setDescription("Name template of each created room, placeholders are: %nickname%, %username%")
		.setDescriptionLocalization("ru", "Шаблон имени каждой новой созданной комнаты, заменяющие слова: %nickname%, %username%")
		.setRequired(true)
	);
	return c;
};