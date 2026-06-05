import fetch from 'node-fetch';

export class CloudflareService {
  constructor() {
    this.apiToken = process.env.CF_API_TOKEN;
    this.accountId = process.env.CF_ACCOUNT_ID;
    this.baseUrl = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/run/@cf/black-forest-labs/flux-1-schnell`;
  }

  async generateLogo(prompt) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      console.log(`Cloudflare response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Cloudflare error response: ${errorText}`);
        throw new Error(`Cloudflare API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log(`Cloudflare response: success=${data.success}, hasImage=${!!data.result?.image}`);

      if (!data.success || !data.result?.image) {
        throw new Error('Invalid response from Cloudflare API');
      }

      return data.result.image;
    } catch (error) {
      if (error.name === 'AbortError') {
        console.error('Cloudflare API timeout after 60 seconds');
        throw new Error('Cloudflare API timeout');
      }
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
    console.log(`Generating ${count} variations for: ${params.brandName}`);
    
    const prompts = [];

    for (let i = 0; i < count; i++) {
      const variation = this.buildPrompt({
        ...params,
        prompt: (params.prompt || '') + (i > 0 ? ` variation ${i + 1}` : '')
      });
      console.log(`Prompt ${i + 1}: ${variation.substring(0, 100)}...`);
      prompts.push(variation);
    }

    console.log('Starting Cloudflare API calls...');
    const results = await Promise.allSettled(
      prompts.map(p => this.generateLogo(p))
    );

    console.log(`Got ${results.length} results from Cloudflare`);

    return results.map((result, index) => ({
      success: result.status === 'fulfilled',
      data: result.status === 'fulfilled' ? result.value : null,
      error: result.status === 'rejected' ? result.reason.message : null,
      prompt: prompts[index]
    }));
  }
}