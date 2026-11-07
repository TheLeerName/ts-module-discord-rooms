import Core from "../../../index.js";
import Module from "../index.js";
import { SlashCommand } from "../../discord/index.js";

import * as Discord from "discord.js";

export default () => {
	const c = new SlashCommand()
	.setVersion(1)
	.setName("rooms-create-category")
	.setDescription(`Creates category for private rooms`)
	.setDescriptionLocalization("ru", `Создаёт канал-категорию для приватных комнат`)
	.setChatInput(async(interaction) => {
		if (!interaction.inCachedGuild()) return;

		const start = Date.now();
		await interaction.deferReply();

		const args: any = {
			guild: `${interaction.guild.name} (${interaction.guild.id})`,
			user: `${interaction.user.username} (${interaction.user.id})`
		};
		try {
			const categoryName = interaction.options.getString("category-name", true);
			args.categoryName = categoryName;
			const createRoomName = interaction.options.getString("create-room-name", true);
			args.createRoomName = createRoomName;

			const guildData = Module.data.getGuild(interaction.guild.id);

			if (guildData.enabled)
				throw new Error("Канал-категория уже был создан!");

			guildData.guild = interaction.guild;
			guildData.categoryChannel = await guildData.guild.channels.create({
				type: Discord.ChannelType.GuildCategory,
				name: categoryName
			});
			args.categoryChannel = `${guildData.categoryChannel} (${guildData.categoryChannel.id})`;

			guildData.createRoomChannel = await guildData.guild.channels.create({
				type: Discord.ChannelType.GuildVoice,
				name: createRoomName,
				parent: guildData.categoryChannel
			});
			args.createRoomChannel = `${guildData.createRoomChannel} (${guildData.createRoomChannel.id})`;

			guildData.enabled = true;
			await Module.data.save();

			await interaction.editReply({embeds: [new Discord.EmbedBuilder()
				.setTitle(`:white_check_mark: Успешно!`)
				.setFields(
					{
						name: "Голосовой канал для создания комнаты",
						value: `<#${guildData.createRoomChannel.id}>`
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
	c.addStringOption(option => option
		.setMinLength(1)
		.setMaxLength(100)
		.setRequired(true)
		.setName("category-name")
		.setDescription("Имя канала-категории")
	).addStringOption(option => option
		.setMinLength(1)
		.setMaxLength(100)
		.setRequired(true)
		.setName("create-room-name")
		.setDescription("Имя голосового канала для создания комнаты")
	);
	return c;
};