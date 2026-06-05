import fetch from 'node-fetch';

export class CloudflareService {
  constructor() {
    this.apiToken = process.env.CF_API_TOKEN;
    this.accountId = process.env.CF_ACCOUNT_ID;
    this.baseUrl = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/run/@cf/black-forest-labs/flux-1-schnell`;
  }

  async generateLogo(prompt) {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Cloudflare API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      if (!data.success || !data.result?.image) {
        throw new Error('Invalid response from Cloudflare API');
      }

      return data.result.image;
    } catch (error) {
      console.error('Cloudflare generation error:', error);
      throw error;
    }
  }

  buildPrompt(params) {
    const { brandName, industry, style, colors, prompt } = params;

    let basePrompt = `Professional logo design`;

    if (brandName) {
      basePrompt += ` for brand "${brandName}"`;
    }

    if (industry) {
      basePrompt += ` in ${industry} industry`;
    }

    if (style) {
      basePrompt += `, ${style} style`;
    }

    if (colors && colors.length > 0) {
      basePrompt += `, using colors ${colors.join(', ')}`;
    }

    if (prompt) {
      basePrompt += `, ${prompt}`;
    }

    basePrompt += ', minimalist, clean, white background, high quality, professional, vector art, simple, elegant';

    return basePrompt;
  }

  async generateVariations(params, count = 4) {
    const prompts = [];

    for (let i = 0; i < count; i++) {
      const variation = this.buildPrompt({
        ...params,
        prompt: params.prompt + (i > 0 ? ` variation ${i + 1}` : '')
      });
      prompts.push(variation);
    }

    const results = await Promise.allSettled(
      prompts.map(p => this.generateLogo(p))
    );

    return results.map((result, index) => ({
      success: result.status === 'fulfilled',
      data: result.status === 'fulfilled' ? result.value : null,
      error: result.status === 'rejected' ? result.reason.message : null,
      prompt: prompts[index]
    }));
  }
}