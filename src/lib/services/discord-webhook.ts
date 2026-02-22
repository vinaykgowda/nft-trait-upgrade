/**
 * Discord Webhook service for posting trait swap notifications.
 *
 * Set DISCORD_WEBHOOK_URL in your environment to enable.
 * The webhook sends a rich embed with the NFT image, wallet, and trait changes.
 */

interface TraitChange {
  trait_type: string;
  value: string | number;
}

interface TraitSwapNotification {
  walletAddress: string;
  nftName: string;
  nftAddress: string;
  imageUrl: string;
  newTraits: TraitChange[];
  txSignature?: string;
}

export async function sendTraitSwapToDiscord(notification: TraitSwapNotification): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    console.log('⏭️ Discord webhook not configured, skipping notification');
    return;
  }

  try {
    const shortWallet = `${notification.walletAddress.slice(0, 4)}...${notification.walletAddress.slice(-4)}`;
    const traitList = notification.newTraits
      .map(t => `**${t.trait_type}** → ${t.value}`)
      .join('\n');

    const solscanUrl = notification.txSignature
      ? `https://solscan.io/tx/${notification.txSignature}`
      : null;

    const magicEdenUrl = `https://magiceden.io/item-details/${notification.nftAddress}`;

    const embed = {
      title: '🎨 Trait Swap Alert!',
      description: `**${notification.nftName}** just got a fresh look!`,
      color: 0x00d4aa, // teal-green
      thumbnail: { url: notification.imageUrl },
      fields: [
        {
          name: '👛 Wallet',
          value: `\`${shortWallet}\``,
          inline: true,
        },
        {
          name: '🖼️ NFT',
          value: `[${notification.nftName}](${magicEdenUrl})`,
          inline: true,
        },
        {
          name: '✨ New Traits',
          value: traitList || 'None',
          inline: false,
        },
        ...(solscanUrl
          ? [{ name: '🔗 Transaction', value: `[View on Solscan](${solscanUrl})`, inline: false }]
          : []),
      ],
      footer: { text: 'Pepeverse Trait Store' },
      timestamp: new Date().toISOString(),
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [embed],
      }),
    });

    if (!response.ok) {
      console.error('❌ Discord webhook failed:', response.status, await response.text());
    } else {
      console.log('✅ Discord notification sent for', notification.nftName);
    }
  } catch (error) {
    // Never let Discord failures break the main flow
    console.error('❌ Discord webhook error (non-blocking):', error);
  }
}
