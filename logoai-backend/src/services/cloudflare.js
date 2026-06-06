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
    const timeoutId = setTimeout(() => controller.abort(), 90000);

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
        if (response.status === 429) {
          const err = new Error('RATE_LIMIT');
          err.rateLimited = true;
          throw err;
        }
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
        console.error('Cloudflare API timeout after 90 seconds');
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

    const safeWords = [
      { from: /technology/gi, to: 'tech' },
      { from: /dark charcoal/gi, to: 'dark gray' },
      { from: /industry/gi, to: 'sector' },
    ];
    const safeSuffixes = [
      ', clean corporate logo, professional',
      ', business brand mark, flat design',
      ', simple icon, vector style',
      ', modern company emblem, minimal',
      ', safe for work, office style',
      ', abstract symbol, geometric',
    ];

    const makeSafePrompt = (base, attempt) => {
      let p = base;
      for (const w of safeWords) p = p.replace(w.from, w.to);
      p += safeSuffixes[attempt % safeSuffixes.length];
      return p;
    };

    console.log('Starting Cloudflare API calls (parallel + retry)...');

    const overallCtrl = new AbortController();
    const overallTimeout = setTimeout(() => overallCtrl.abort(), 180000);

    const results = await Promise.allSettled(
      prompts.map((prompt, i) => this.generateLogo(prompt))
    );

    const images = [];
    const failedIndices = [];
    let rateLimited = false;
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        images.push({ success: true, data: r.value, index: i });
        console.log(`Initial ${i + 1}: success (${images.filter(x => x.success).length}/${count})`);
      } else {
        if (r.reason?.rateLimited) rateLimited = true;
        failedIndices.push(i);
        console.error(`Initial ${i + 1}: failed - ${r.reason?.message}`);
      }
    });

    if (rateLimited) {
      console.error('Rate limited by Cloudflare — skipping retries');
      clearTimeout(overallTimeout);
      const successful = images.filter(r => r.success);
      console.log(`Got ${successful.length} successful results (rate limited)`);
      return successful;
    }

    let retryRound = 0;
    while (images.filter(x => x.success).length < count && failedIndices.length > 0 && retryRound < 4 && !overallCtrl.signal.aborted) {
      const retryPromises = failedIndices.map(idx => {
        const prompt = makeSafePrompt(prompts[idx], retryRound);
        return this.generateLogo(prompt).then(img => ({ img, idx })).catch(e => e);
      });
      const retryResults = await Promise.allSettled(retryPromises);
      const stillFailed = [];
      let hitRateLimit = false;
      retryResults.forEach((r, ri) => {
        const origIdx = failedIndices[ri];
        if (r.status === 'fulfilled' && r.value?.img) {
          images.push({ success: true, data: r.value.img, index: origIdx });
          console.log(`Retry ${retryRound + 1}/${origIdx + 1}: success (${images.filter(x => x.success).length}/${count})`);
        } else {
          const err = r.status === 'rejected' ? r.reason : r.value;
          if (err?.rateLimited) hitRateLimit = true;
          stillFailed.push(origIdx);
          console.error(`Retry ${retryRound + 1}/${origIdx + 1}: failed - ${err?.message || 'unknown'}`);
        }
      });
      if (hitRateLimit) {
        console.error('Rate limited during retry — stopping');
        break;
      }
      failedIndices.length = 0;
      failedIndices.push(...stillFailed);
      retryRound++;
    }

    clearTimeout(overallTimeout);
    const successful = images.filter(r => r.success);
    console.log(`Got ${successful.length} successful results`);
    return successful;
  }
}