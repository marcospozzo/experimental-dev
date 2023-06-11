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

    // const chatHistory =
    //   "And so, the legend of Aria, the Queen of Avaloria, became etched in the annals of history, inspiring generations to come with her tale of hope, resilience, and the triumph of light over darkness. Aria's bravery and selflessness had saved the kingdom, and as a token of their gratitude, the people of Avaloria crowned her as their new queen. Under her wise rule, the land prospered anew, and the tales of her heroic journey echoed throughout generations, reminding everyone of the power of courage, unity, and the indomitable spirit that resides within every heart. In the decisive moment, Aria summoned the power of the Crystal of Dawn, unleashing a blinding burst of light that shattered the curse and brought warmth and life back to Avaloria. The eternal winter melted away, and the land bloomed once more with lush greenery and vibrant colors. With the Crystal of Dawn in her possession, Aria harnessed its radiant energy and set forth towards the heart of Avaloria. As she reached the cursed city, she confronted Malachi in a fierce battle of wills and magic. The clash between good and evil echoed throughout the realm, shaking the very foundations of the kingdom. Their journey led them to the mystical Temple of Ancients, where the Crystal of Dawn was said to be hidden. Protected by ancient guardians, the temple presented Aria and her companions with a series of daunting trials, testing their courage, wisdom, and unity. Through unwavering determination and unwavering faith in their cause, they successfully conquered each challenge and finally stood before the coveted crystal. Aria traversed treacherous terrains, battling fearsome creatures and overcoming numerous obstacles along the way. She met kind-hearted strangers who offered their assistance, and together, they formed a band of unlikely heroes united in their quest to defeat Malachi and save Avaloria. News of the curse reached the far corners of the land, reaching the ears of a young and courageous warrior named Aria. Determined to restore Avaloria to its former glory, she set out on a perilous journey to find the legendary Crystal of Dawn—a powerful artifact said to possess the ability to break any curse. However, deep within the heart of the kingdom, a dark force began to stir. A wicked sorcerer named Malachi had grown envious of King Alaric's power and sought to claim it for himself. Malachi delved into forbidden magics and unleashed a curse upon Avaloria, plunging the kingdom into an eternal winter. The once vibrant fields turned into icy wastelands, and the people lived in constant fear and despair. Once upon a time, in the mystical land of Eldoria, there existed a kingdom known as Avaloria. It was a land of breathtaking landscapes, enchanted forests, and towering mountains. The kingdom was ruled by a wise and just king named Alaric, whose reign brought prosperity and harmony to the land. Under his rule, Avaloria thrived, and its people lived in peace and contentment. <@U05BHNQHNTH> dsa dasd";

    summarizeSlackChannel(channelId);

    if (channelId) {
      response.message = `The ID of '${channelName}' is: ${channelId}`;

      // Enqueue the summarization task in the background
      //   summarizeSlackChannelInBackground(channelId, userId, token);
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
  //   const prompt = `Summarize this whole Slack channel:\n\n${chatHistory}`;
  const prompt = "whats the weather like in argentina?";

  try {
    // Make the API call
    const response = await openai.createCompletion({
      model: "text-davinci-003",
      prompt: prompt,
      temperature: 1,
      max_tokens: 256,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    });

    console.log(response.data.choices);
    // Extract and return the summary
    // const summary = response.choices[0].text.trim();
    return response;
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
