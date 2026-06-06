import fetch from 'node-fetch';

export class CloudflareService {
  constructor() {
    this.apiToken = process.env.CF_API_TOKEN;
    this.accountId = process.env.CF_ACCOUNT_ID;
    this.baseUrl = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/run/@cf/black-forest-labs/flux-1-schnell`;

    this.industryMap = {
      'Технологии': 'technology',
      'Дизайн': 'design',
      'Медицина': 'healthcare',
      'Еда и рестораны': 'food and restaurant',
      'Образование': 'education',
      'Финансы': 'finance',
      'Спорт': 'sports',
      'Другое': 'general'
    };

    this.styleMap = {
      'Минималистичный': 'minimalist',
      'Геометрический': 'geometric',
      'Ретро / Vintage': 'retro vintage',
      'Современный': 'modern',
      'Рукописный': 'handwritten',
      'Абстрактный': 'abstract'
    };

    this.colorMap = {
      '#C68DFF': 'purple violet',
      '#c68dff': 'purple violet',
      '#CBE857': 'lime green yellow',
      '#cbe857': 'lime green yellow',
      '#323843': 'dark charcoal',
      '#FFFFFF': 'white',
      '#ffffff': 'white',
      '#5BA84A': 'green',
      '#5ba84a': 'green',
      '#E25A6F': 'pink rose',
      '#e25a6f': 'pink rose'
    };
  }

  async generateLogo(prompt) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt }),
        signal: controller.signal
      });

      console.log(`Cloudflare response status: ${response.status}`);

      if (!response.ok) {
        clearTimeout(timeoutId);
        const errorText = await response.text();
        console.error(`Cloudflare error response: ${errorText}`);
        throw new Error(`Cloudflare API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      clearTimeout(timeoutId);
      console.log(`Cloudflare response: success=${data.success}, hasImage=${!!data.result?.image}, imageSize=${data.result?.image?.length}`);

      if (!data.success || !data.result?.image) {
        throw new Error('Invalid response from Cloudflare API');
      }

      return data.result.image;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        console.error('Cloudflare API timeout after 30 seconds');
        throw new Error('Cloudflare API timeout');
      }
      console.error('Cloudflare generation error:', error);
      throw error;
    }
  }

  buildPrompt(params) {
    const { brandName, industry, style, colors, prompt } = params;

    const indEn = this.industryMap[industry] || industry || '';
    const styEn = this.styleMap[style] || style || '';

    let basePrompt = `Professional logo design`;

    if (brandName) {
      basePrompt += ` for brand "${brandName}"`;
    }

    if (indEn) {
      basePrompt += ` in ${indEn} industry`;
    }

    if (styEn) {
      basePrompt += `, ${styEn} style`;
    }

    if (colors && colors.length > 0) {
      const colorNames = colors.map(c => this.colorMap[c] || this.colorMap[c.toUpperCase()] || this.colorMap[c.toLowerCase()] || c);
      basePrompt += `, using ${colorNames.join(' and ')} color palette`;
    }

    if (prompt) {
      basePrompt += `, ${prompt}`;
    }

    basePrompt += ', minimalist, clean, white background, high quality, professional, vector art, simple, elegant';

    return basePrompt;
  }

  async translateToEnglish(text) {
    if (!text) return text;
    const hasCyrillic = /[а-яА-ЯёЁ]/.test(text);
    if (!hasCyrillic) return text;

    try {
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.substring(0, 500))}&langpair=ru|en`;
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(tid);
      const data = await res.json();
      if (data.responseStatus === 200 && data.responseData?.translatedText) {
        const translated = data.responseData.translatedText;
        console.log(`Translated prompt: "${text.substring(0, 60)}..." → "${translated.substring(0, 60)}..."`);
        return translated;
      }
    } catch (err) {
      console.warn('Translation failed, using original prompt:', err.message);
    }
    return text;
  }

  async generateVariations(params, count = 4) {
    console.log(`Generating ${count} variations for: ${params.brandName}`);

    let userPrompt = params.prompt || '';
    if (userPrompt && params.brandName) {
      const placeholder = '___BRANDNAME___';
      const safePrompt = userPrompt.split(params.brandName).join(placeholder);
      const translated = await this.translateToEnglish(safePrompt);
      userPrompt = translated.split(placeholder).join(params.brandName);
    } else {
      userPrompt = await this.translateToEnglish(userPrompt);
    }

    const prompts = [];

    for (let i = 0; i < count; i++) {
      const variation = this.buildPrompt({
        ...params,
        prompt: (userPrompt || '') + (i > 0 ? ` variation ${i + 1}` : '')
      });
      console.log(`Prompt ${i + 1}: ${variation.substring(0, 100)}...`);
      prompts.push(variation);
    }

    console.log('Starting Cloudflare API calls (sequential with timeout)...');
    const results = [];

    const overallCtrl = new AbortController();
    const overallTimeout = setTimeout(() => overallCtrl.abort(), 150000);

    for (let i = 0; i < prompts.length; i++) {
      if (overallCtrl.signal.aborted) {
        console.error('Overall generation timeout, stopping remaining variations');
        results.push({ success: false, data: null, error: 'Overall timeout', prompt: prompts[i] });
        continue;
      }
      try {
        const image = await this.generateLogo(prompts[i]);
        results.push({ success: true, data: image, error: null, prompt: prompts[i] });
        console.log(`Variation ${i + 1}/${prompts.length} succeeded`);
      } catch (err) {
        console.error(`Variation ${i + 1}/${prompts.length} failed: ${err.message}`);
        results.push({ success: false, data: null, error: err.message, prompt: prompts[i] });
      }
    }

    clearTimeout(overallTimeout);

    console.log(`Got ${results.filter(r => r.success).length}/${results.length} successful results`);
    return results;
  }
}