/**
 * Discord Webhook service for posting trait swap notifications.
 *
 * Set DISCORD_WEBHOOK_URL in your environment to enable.
 * Uses two embeds side-by-side: old NFT (Before) and new NFT (After).
 */

interface TraitChange {
  trait_type: string;
  value: string | number;
}

interface TraitSwapNotification {
  walletAddress: string;
  nftName: string;
  nftAddress: string;
  /** The NEW (upgraded) image URL */
  imageUrl: string;
  /** The OLD (original) image URL before the swap */
  oldImageUrl?: string;
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

    const magicEdenUrl = `https://magiceden.io/item-details/${notification.nftAddress}`;

    // Main embed with info + new image as the large image
    const mainEmbed: any = {
      title: '🎨 Trait Swap Alert!',
      description: `**[${notification.nftName}](${magicEdenUrl})** just got a fresh look!\n\n👛 Wallet: \`${shortWallet}\``,
      color: 0x00d4aa,
      fields: [
        {
          name: '✨ New Traits',
          value: traitList || 'None',
          inline: false,
        },
      ],
      footer: { text: 'Pepeverse Trait Store' },
      timestamp: new Date().toISOString(),
    };

    // If we have the old image, show it as thumbnail (small, top-right)
    // and the new image as the large image (bottom)
    if (notification.oldImageUrl) {
      mainEmbed.thumbnail = { url: notification.oldImageUrl };
      mainEmbed.image = { url: notification.imageUrl };
      // Add labels so it's clear which is which
      mainEmbed.description += `\n\n🖼️ **Before** (top-right) → **After** (below)`;
    } else {
      // No old image, just show the new one as large image
      mainEmbed.image = { url: notification.imageUrl };
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [mainEmbed],
      }),
    });

    if (!response.ok) {
      console.error('❌ Discord webhook failed:', response.status, await response.text());
    } else {
      console.log('✅ Discord notification sent for', notification.nftName);
    }
  } catch (error) {
    console.error('❌ Discord webhook error (non-blocking):', error);
  }
}
