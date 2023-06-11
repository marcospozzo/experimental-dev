const axios = require("axios");
const querystring = require("querystring");
const { Configuration, OpenAIApi } = require("openai");
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

const token = process.env.SLACK_BOT_TOKEN;

exports.handler = async (event, context, callback) => {
  try {
    const body = querystring.parse(
      Buffer.from(event.body, "base64").toString("utf-8")
    );

    const channelName = body.text;
    const userId = body.user_id;
    let response = {};

    // sendSummaryToUser(userId, "summaryyy", token);

    const channelId = await getChannelId(channelName);

    if (channelId) {
      response.message = `The ID of '${channelName}' is: ${channelId}`;

      // Enqueue the summarization task in the background
      summarizeSlackChannelInBackground(channelId, userId, token);
    } else {
      response.message = `Channel '${channelName}' not found.`;
    }

    // Invoke the callback function with the response
    callback(null, {
      statusCode: 200,
      body: JSON.stringify(response),
    });
  } catch (error) {
    // Handle errors and include error message in the response
    console.error(`Error occurred: ${error}`);
    callback(null, {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    });
  }
};

async function getChannelId(channelName) {
  const url = "https://slack.com/api/conversations.list";

  try {
    const response = await axios.get(url, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.data.ok) {
      const channels = response.data.channels;
      const channel = channels.find((c) => c.name === channelName);
      if (channel) {
        return channel.id;
      } else {
        throw new Error(`Channel '${channelName}' not found.`);
      }
    } else {
      throw new Error("Failed to retrieve channel list.");
    }
  } catch (error) {
    throw new Error(
      `Error occurred while retrieving channel list: ${error.message}`
    );
  }
}

async function summarizeSlackChannelInBackground(channelId, userId, token) {
  try {
    const messages = await getChannelMessages(channelId);
    // Filter out all the messages that contain subtype prop (such as welcome messages)
    const filteredMessages = messages.filter((message) => !message.subtype);
    const textCompilation = filteredMessages
      .map((message) => message.text)
      .join(" ");
    const summary = await summarizeSlackChannel(textCompilation);

    // Send DM to the user that requested the channel summary
    await sendSummaryToUser(userId, summary, token);
  } catch (error) {
    console.error("Error occurred while summarizing Slack channel:", error);
    // Handle the error appropriately, e.g., log, notify, etc.
  }
}

async function getChannelMessages(channelId) {
  const url = `https://slack.com/api/conversations.history?channel=${channelId}`;

  try {
    const response = await axios.get(url, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.data.ok) {
      const messages = response.data.messages;
      return messages;
    } else {
      throw new Error(
        `Failed to retrieve channel messages: ${response.data.error}`
      );
    }
  } catch (error) {
    throw new Error(
      `Error occurred while retrieving channel messages: ${error.message}`
    );
  }
}

async function summarizeSlackChannel(chatHistory) {
  const prompt = `Summarize this whole Slack channel:\n\n${chatHistory}`;
  try {
    const response = await openai.createCompletion({
      model: "text-davinci-003",
      prompt: prompt,
      max_tokens: 256,
      temperature: 0,
    });

    const summary = response.data.choices[0].text.trim();
    console.log(summary);
    return summary;
  } catch (error) {
    console.error("Error:", error);
    throw new Error("Failed to summarize Slack channel.");
  }
}

async function sendSummaryToUser(userId, summary, token) {
  console.log(summary);
  try {
    // Open a DM channel with the user
    const response = await axios.post(
      "https://slack.com/api/conversations.open",
      {
        users: userId,
      },
      {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const dmChannelId = response.data.channel.id;

    // Send a DM to the user
    const message = {
      channel: dmChannelId,
      text: "dm from the bot",
    };

    await axios.post("https://slack.com/api/chat.postMessage", message, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (error) {
    console.error("Error occurred while sending summary to user:", error);
    // Handle the error appropriately, e.g., log, notify, etc.
  }
}
