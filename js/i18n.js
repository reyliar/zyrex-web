/*!
 * Zyrex site language system.
 *
 * Every page loads this file. It:
 *  - restores the visitor's language from localStorage (and from their Discord
 *    account once they are signed in),
 *  - translates the visible page (text nodes + a few attributes) using the
 *    per-language packs in /js/i18n/,
 *  - keeps translating content that scripts render later,
 *  - renders the round language switcher in the bottom-left corner.
 *
 * English is the source language and the default: no English pack is loaded.
 */
(function () {
    'use strict';

    if (window.ZyrexI18n) return;

    var STORAGE_KEY = 'zyrex_lang';
    var PACK_PATH = '/js/i18n/';
    var PACK_VERSION = '19';
    var ACCOUNT_ENDPOINT = '/api/profile/language';
    var AUTH_CACHE_KEY = 'zyrex_auth_user';

    var LANGUAGES = [
        { code: 'en', native: 'English', english: 'English', dir: 'ltr' },
        { code: 'tr', native: 'TÃ¼rkÃ§e', english: 'Turkish', dir: 'ltr' },
        { code: 'pt', native: 'PortuguÃªs', english: 'Portuguese', dir: 'ltr' },
        { code: 'es', native: 'EspaÃ±ol', english: 'Spanish', dir: 'ltr' },
        { code: 'ko', native: 'í•œêµ­ì–´', english: 'Korean', dir: 'ltr' },
        { code: 'zh', native: 'ä¸­æ–‡', english: 'Chinese', dir: 'ltr' },
        { code: 'ar', native: 'Ø§Ù„Ø¹Ø±Ø¨ÙŠØ©', english: 'Arabic', dir: 'rtl' },
        { code: 'ru', native: 'Ğ ÑƒÑÑĞºĞ¸Ğ¹', english: 'Russian', dir: 'ltr' }
    ];
    var LANG_BY_CODE = {};
    LANGUAGES.forEach(function (lang) { LANG_BY_CODE[lang.code] = lang; });

    var SKIP_SELECTOR = [
        'script', 'style', 'noscript', 'textarea', 'code', 'pre', 'kbd', 'samp',
        'svg', 'math', 'canvas', '[contenteditable="true"]', '[contenteditable=""]',
        '[data-i18n-skip]', '[data-no-i18n]', '.zr-lang', '.no-i18n'
    ].join(',');
    var SKIP_ATTRIBUTE_SELECTOR = [
        'script', 'style', 'noscript', 'code', 'pre', 'kbd', 'samp', 'svg', 'math', 'canvas',
        '[contenteditable="true"]', '[contenteditable=""]',
        '[data-i18n-skip]', '[data-no-i18n]', '.zr-lang', '.no-i18n'
    ].join(',');

    var ATTRS = ['placeholder', 'title', 'aria-label', 'alt', 'data-tooltip'];

    // Fallback copy for the switcher when a language pack has not loaded yet.
    var UI_EN = {
        'Language': 'Language',
        'Site language': 'Site language',
        'Choose the language used across Zyrex.': 'Choose the language used across Zyrex.',
        'Saved in this browser and on your Discord account.': 'Saved in this browser and on your Discord account.',
        'Change language': 'Change language',
        'Close': 'Close'
    };

    /* Page copy added during the requests redesign. Keep it in the same lookup
       path as language packs so dynamically rendered scraper status is translated too. */
    var PAGE_COPY = {
        tr: {
            'COMMUNITY BOARD': 'TOPLULUK TAHTASI', 'DISCOVER': 'KEÅFET', 'Find a request': 'Bir istek bul', 'Filter the board': 'Ä°stekleri filtrele',
            'Product details are filled by Scrapin automatically.': 'ÃœrÃ¼n bilgileri Scrapin tarafÄ±ndan otomatik doldurulur.', 'Scrapin is loading product detailsâ€¦': 'Scrapin Ã¼rÃ¼n bilgilerini yÃ¼klÃ¼yorâ€¦',
            'Product details loaded from Scrapin.': 'ÃœrÃ¼n bilgileri Scrapin ile yÃ¼klendi.', 'Scrapin could not read this product link.': 'Scrapin bu Ã¼rÃ¼n baÄŸlantÄ±sÄ±nÄ± okuyamadÄ±.', 'Product lookup failed. You can still fill the request manually.': 'ÃœrÃ¼n bilgileri alÄ±namadÄ±. Ä°steÄŸi yine de elle doldurabilirsiniz.',
            'Step 1: Resolving Profile': '1. AdÄ±m: Profil bulunuyor', 'Fetching creator name & avatar...': 'Ä°Ã§erik Ã¼reticisinin adÄ± ve profil fotoÄŸrafÄ± alÄ±nÄ±yorâ€¦', 'Profile Lookup Failed': 'Profil bulunamadÄ±', 'Profile Set': 'Profil eklendi', 'Lookup Failed': 'Arama baÅŸarÄ±sÄ±z', 'Retry Lookup': 'Yeniden dene',
            'Scrapin could not resolve this profile right now. You can retry or enter creator details manually.': 'Scrapin ÅŸu anda bu profili bulamadÄ±. Yeniden deneyebilir veya iÃ§erik Ã¼reticisi bilgilerini elle girebilirsiniz.', 'This creator profile was not found by Scrapin.': 'Scrapin bu iÃ§erik Ã¼reticisi profilini bulamadÄ±.', 'Scrapin could not process this profile URL.': 'Scrapin bu profil baÄŸlantÄ±sÄ±nÄ± iÅŸleyemedi.', 'Scrapin is rate limiting profile lookups. Try again shortly.': 'Scrapin profil aramalarÄ±nÄ± geÃ§ici olarak sÄ±nÄ±rlÄ±yor. Biraz sonra yeniden deneyin.', 'Scrapin took too long to resolve this creator. Try again.': 'Scrapin iÃ§erik Ã¼reticisini bulurken zaman aÅŸÄ±mÄ±na uÄŸradÄ±. Yeniden deneyin.', 'Scrapin could not resolve this creator right now.': 'Scrapin ÅŸu anda bu iÃ§erik Ã¼reticisini bulamadÄ±.', 'This social profile URL is not supported.': 'Bu sosyal medya profil baÄŸlantÄ±sÄ± desteklenmiyor.'
        },
        es: {
            'COMMUNITY BOARD': 'TABLERO DE LA COMUNIDAD', 'DISCOVER': 'DESCUBRIR', 'Find a request': 'Encuentra una solicitud', 'Filter the board': 'Filtrar solicitudes',
            'Product details are filled by Scrapin automatically.': 'Scrapin completa automÃ¡ticamente los datos del producto.', 'Scrapin is loading product detailsâ€¦': 'Scrapin estÃ¡ cargando los datos del productoâ€¦',
            'Product details loaded from Scrapin.': 'Datos del producto cargados desde Scrapin.', 'Scrapin could not read this product link.': 'Scrapin no pudo leer este enlace de producto.', 'Product lookup failed. You can still fill the request manually.': 'No se pudo encontrar el producto. AÃºn puedes completar la solicitud manualmente.',
            'Step 1: Resolving Profile': 'Paso 1: Buscando el perfil', 'Fetching creator name & avatar...': 'Obteniendo el nombre y la foto del creadorâ€¦', 'Profile Lookup Failed': 'No se pudo encontrar el perfil', 'Profile Set': 'Perfil aÃ±adido', 'Lookup Failed': 'BÃºsqueda fallida', 'Retry Lookup': 'Reintentar bÃºsqueda',
            'Scrapin could not resolve this profile right now. You can retry or enter creator details manually.': 'Scrapin no pudo encontrar este perfil. Puedes intentarlo de nuevo o introducir los datos del creador manualmente.', 'This creator profile was not found by Scrapin.': 'Scrapin no encontrÃ³ este perfil de creador.', 'Scrapin could not process this profile URL.': 'Scrapin no pudo procesar este enlace de perfil.', 'Scrapin is rate limiting profile lookups. Try again shortly.': 'Scrapin estÃ¡ limitando temporalmente las bÃºsquedas. IntÃ©ntalo de nuevo pronto.', 'Scrapin took too long to resolve this creator. Try again.': 'Scrapin tardÃ³ demasiado en encontrar este creador. IntÃ©ntalo de nuevo.', 'Scrapin could not resolve this creator right now.': 'Scrapin no pudo encontrar a este creador en este momento.', 'This social profile URL is not supported.': 'Este enlace de perfil social no es compatible.'
        },
        pt: {
            'COMMUNITY BOARD': 'QUADRO DA COMUNIDADE', 'DISCOVER': 'DESCOBRIR', 'Find a request': 'Encontre um pedido', 'Filter the board': 'Filtrar pedidos',
            'Product details are filled by Scrapin automatically.': 'O Scrapin preenche os dados do produto automaticamente.', 'Scrapin is loading product detailsâ€¦': 'O Scrapin estÃ¡ carregando os dados do produtoâ€¦',
            'Product details loaded from Scrapin.': 'Dados do produto carregados pelo Scrapin.', 'Scrapin could not read this product link.': 'O Scrapin nÃ£o conseguiu ler este link de produto.', 'Product lookup failed. You can still fill the request manually.': 'NÃ£o foi possÃ­vel buscar o produto. VocÃª ainda pode preencher o pedido manualmente.',
            'Step 1: Resolving Profile': 'Etapa 1: Localizando perfil', 'Fetching creator name & avatar...': 'Buscando o nome e a foto do criadorâ€¦', 'Profile Lookup Failed': 'Perfil nÃ£o encontrado', 'Profile Set': 'Perfil adicionado', 'Lookup Failed': 'Falha na busca', 'Retry Lookup': 'Tentar novamente',
            'Scrapin could not resolve this profile right now. You can retry or enter creator details manually.': 'O Scrapin nÃ£o encontrou este perfil. Tente novamente ou informe os dados do criador manualmente.', 'This creator profile was not found by Scrapin.': 'O Scrapin nÃ£o encontrou este perfil de criador.', 'Scrapin could not process this profile URL.': 'O Scrapin nÃ£o conseguiu processar este link de perfil.', 'Scrapin is rate limiting profile lookups. Try again shortly.': 'O Scrapin estÃ¡ limitando as buscas temporariamente. Tente novamente em instantes.', 'Scrapin took too long to resolve this creator. Try again.': 'O Scrapin demorou demais para localizar este criador. Tente novamente.', 'Scrapin could not resolve this creator right now.': 'O Scrapin nÃ£o conseguiu localizar este criador agora.', 'This social profile URL is not supported.': 'Este link de perfil social nÃ£o Ã© compatÃ­vel.'
        },
        ru: {
            'COMMUNITY BOARD': 'Ğ¡ĞĞĞ‘Ğ©Ğ•Ğ¡Ğ¢Ğ’Ğ', 'DISCOVER': 'ĞĞ¢ĞšĞ Ğ«Ğ¢Ğ¬', 'Find a request': 'ĞĞ°Ğ¹Ñ‚Ğ¸ Ğ·Ğ°Ğ¿Ñ€Ğ¾Ñ', 'Filter the board': 'Ğ¤Ğ¸Ğ»ÑŒÑ‚Ñ€ Ğ·Ğ°Ğ¿Ñ€Ğ¾ÑĞ¾Ğ²',
            'Product details are filled by Scrapin automatically.': 'Scrapin Ğ°Ğ²Ñ‚Ğ¾Ğ¼Ğ°Ñ‚Ğ¸Ñ‡ĞµÑĞºĞ¸ Ğ·Ğ°Ğ¿Ğ¾Ğ»Ğ½Ğ¸Ñ‚ ÑĞ²ĞµĞ´ĞµĞ½Ğ¸Ñ Ğ¾ Ğ¿Ñ€Ğ¾Ğ´ÑƒĞºÑ‚Ğµ.', 'Scrapin is loading product detailsâ€¦': 'Scrapin Ğ·Ğ°Ğ³Ñ€ÑƒĞ¶Ğ°ĞµÑ‚ ÑĞ²ĞµĞ´ĞµĞ½Ğ¸Ñ Ğ¾ Ğ¿Ñ€Ğ¾Ğ´ÑƒĞºÑ‚Ğµâ€¦',
            'Product details loaded from Scrapin.': 'Ğ¡Ğ²ĞµĞ´ĞµĞ½Ğ¸Ñ Ğ¾ Ğ¿Ñ€Ğ¾Ğ´ÑƒĞºÑ‚Ğµ Ğ·Ğ°Ğ³Ñ€ÑƒĞ¶ĞµĞ½Ñ‹ Ñ‡ĞµÑ€ĞµĞ· Scrapin.', 'Scrapin could not read this product link.': 'Scrapin Ğ½Ğµ ÑƒĞ´Ğ°Ğ»Ğ¾ÑÑŒ Ğ¿Ñ€Ğ¾Ñ‡Ğ¸Ñ‚Ğ°Ñ‚ÑŒ ÑÑ‚Ñƒ ÑÑÑ‹Ğ»ĞºÑƒ Ğ½Ğ° Ğ¿Ñ€Ğ¾Ğ´ÑƒĞºÑ‚.', 'Product lookup failed. You can still fill the request manually.': 'ĞĞµ ÑƒĞ´Ğ°Ğ»Ğ¾ÑÑŒ Ğ½Ğ°Ğ¹Ñ‚Ğ¸ Ğ¿Ñ€Ğ¾Ğ´ÑƒĞºÑ‚. Ğ—Ğ°Ğ¿Ñ€Ğ¾Ñ Ğ¼Ğ¾Ğ¶Ğ½Ğ¾ Ğ·Ğ°Ğ¿Ğ¾Ğ»Ğ½Ğ¸Ñ‚ÑŒ Ğ²Ñ€ÑƒÑ‡Ğ½ÑƒÑ.',
            'Step 1: Resolving Profile': 'Ğ¨Ğ°Ğ³ 1: ĞŸĞ¾Ğ¸ÑĞº Ğ¿Ñ€Ğ¾Ñ„Ğ¸Ğ»Ñ', 'Fetching creator name & avatar...': 'Ğ—Ğ°Ğ³Ñ€ÑƒĞ¶Ğ°ĞµĞ¼ Ğ¸Ğ¼Ñ Ğ¸ Ñ„Ğ¾Ñ‚Ğ¾ Ğ°Ğ²Ñ‚Ğ¾Ñ€Ğ°â€¦', 'Profile Lookup Failed': 'ĞŸÑ€Ğ¾Ñ„Ğ¸Ğ»ÑŒ Ğ½Ğµ Ğ½Ğ°Ğ¹Ğ´ĞµĞ½', 'Profile Set': 'ĞŸÑ€Ğ¾Ñ„Ğ¸Ğ»ÑŒ Ğ´Ğ¾Ğ±Ğ°Ğ²Ğ»ĞµĞ½', 'Lookup Failed': 'ĞŸĞ¾Ğ¸ÑĞº Ğ½Ğµ ÑƒĞ´Ğ°Ğ»ÑÑ', 'Retry Lookup': 'ĞŸĞ¾Ğ²Ñ‚Ğ¾Ñ€Ğ¸Ñ‚ÑŒ Ğ¿Ğ¾Ğ¸ÑĞº',
            'Scrapin could not resolve this profile right now. You can retry or enter creator details manually.': 'Scrapin Ğ½Ğµ ÑƒĞ´Ğ°Ğ»Ğ¾ÑÑŒ Ğ½Ğ°Ğ¹Ñ‚Ğ¸ ÑÑ‚Ğ¾Ñ‚ Ğ¿Ñ€Ğ¾Ñ„Ğ¸Ğ»ÑŒ. ĞŸĞ¾Ğ¿Ñ€Ğ¾Ğ±ÑƒĞ¹Ñ‚Ğµ ĞµÑ‰Ñ‘ Ñ€Ğ°Ğ· Ğ¸Ğ»Ğ¸ Ğ²Ğ²ĞµĞ´Ğ¸Ñ‚Ğµ Ğ´Ğ°Ğ½Ğ½Ñ‹Ğµ Ğ°Ğ²Ñ‚Ğ¾Ñ€Ğ° Ğ²Ñ€ÑƒÑ‡Ğ½ÑƒÑ.', 'This creator profile was not found by Scrapin.': 'Scrapin Ğ½Ğµ Ğ½Ğ°ÑˆÑ‘Ğ» Ğ¿Ñ€Ğ¾Ñ„Ğ¸Ğ»ÑŒ ÑÑ‚Ğ¾Ğ³Ğ¾ Ğ°Ğ²Ñ‚Ğ¾Ñ€Ğ°.', 'Scrapin could not process this profile URL.': 'Scrapin Ğ½Ğµ ÑƒĞ´Ğ°Ğ»Ğ¾ÑÑŒ Ğ¾Ğ±Ñ€Ğ°Ğ±Ğ¾Ñ‚Ğ°Ñ‚ÑŒ ÑÑÑ‹Ğ»ĞºÑƒ Ğ½Ğ° Ğ¿Ñ€Ğ¾Ñ„Ğ¸Ğ»ÑŒ.', 'Scrapin is rate limiting profile lookups. Try again shortly.': 'Scrapin Ğ²Ñ€ĞµĞ¼ĞµĞ½Ğ½Ğ¾ Ğ¾Ğ³Ñ€Ğ°Ğ½Ğ¸Ñ‡Ğ¸Ğ²Ğ°ĞµÑ‚ Ğ¿Ğ¾Ğ¸ÑĞº Ğ¿Ñ€Ğ¾Ñ„Ğ¸Ğ»ĞµĞ¹. ĞŸĞ¾Ğ²Ñ‚Ğ¾Ñ€Ğ¸Ñ‚Ğµ Ğ¿Ğ¾Ğ¿Ñ‹Ñ‚ĞºÑƒ Ğ¿Ğ¾Ğ·Ğ¶Ğµ.', 'Scrapin took too long to resolve this creator. Try again.': 'Scrapin Ğ½Ğµ ÑƒÑĞ¿ĞµĞ» Ğ½Ğ°Ğ¹Ñ‚Ğ¸ Ğ°Ğ²Ñ‚Ğ¾Ñ€Ğ°. ĞŸĞ¾Ğ²Ñ‚Ğ¾Ñ€Ğ¸Ñ‚Ğµ Ğ¿Ğ¾Ğ¿Ñ‹Ñ‚ĞºÑƒ.', 'Scrapin could not resolve this creator right now.': 'Scrapin ÑĞµĞ¹Ñ‡Ğ°Ñ Ğ½Ğµ ÑƒĞ´Ğ°Ğ»Ğ¾ÑÑŒ Ğ½Ğ°Ğ¹Ñ‚Ğ¸ ÑÑ‚Ğ¾Ğ³Ğ¾ Ğ°Ğ²Ñ‚Ğ¾Ñ€Ğ°.', 'This social profile URL is not supported.': 'Ğ­Ñ‚Ğ° ÑÑÑ‹Ğ»ĞºĞ° Ğ½Ğ° ÑĞ¾Ñ†Ğ¸Ğ°Ğ»ÑŒĞ½Ñ‹Ğ¹ Ğ¿Ñ€Ğ¾Ñ„Ğ¸Ğ»ÑŒ Ğ½Ğµ Ğ¿Ğ¾Ğ´Ğ´ĞµÑ€Ğ¶Ğ¸Ğ²Ğ°ĞµÑ‚ÑÑ.'
        },
        zh: {
            'COMMUNITY BOARD': 'ç¤¾åŒºè¯·æ±‚', 'DISCOVER': 'å‘ç°', 'Find a request': 'æŸ¥æ‰¾è¯·æ±‚', 'Filter the board': 'ç­›é€‰è¯·æ±‚',
            'Product details are filled by Scrapin automatically.': 'Scrapin ä¼šè‡ªåŠ¨å¡«å†™äº§å“ä¿¡æ¯ã€‚', 'Scrapin is loading product detailsâ€¦': 'Scrapin æ­£åœ¨åŠ è½½äº§å“ä¿¡æ¯â€¦',
            'Product details loaded from Scrapin.': 'å·²ä» Scrapin åŠ è½½äº§å“ä¿¡æ¯ã€‚', 'Scrapin could not read this product link.': 'Scrapin æ— æ³•è¯»å–æ­¤äº§å“é“¾æ¥ã€‚', 'Product lookup failed. You can still fill the request manually.': 'æ— æ³•æŸ¥æ‰¾äº§å“ã€‚ä½ ä»å¯æ‰‹åŠ¨å¡«å†™è¯·æ±‚ã€‚',
            'Step 1: Resolving Profile': 'ç¬¬ 1 æ­¥ï¼šæŸ¥æ‰¾ä¸»é¡µ', 'Fetching creator name & avatar...': 'æ­£åœ¨è·å–åˆ›ä½œè€…åç§°å’Œå¤´åƒâ€¦', 'Profile Lookup Failed': 'æœªæ‰¾åˆ°ä¸»é¡µ', 'Profile Set': 'ä¸»é¡µå·²æ·»åŠ ', 'Lookup Failed': 'æŸ¥æ‰¾å¤±è´¥', 'Retry Lookup': 'é‡è¯•æŸ¥æ‰¾',
            'Scrapin could not resolve this profile right now. You can retry or enter creator details manually.': 'Scrapin æš‚æ—¶æ— æ³•æŸ¥æ‰¾æ­¤ä¸»é¡µã€‚è¯·é‡è¯•æˆ–æ‰‹åŠ¨å¡«å†™åˆ›ä½œè€…ä¿¡æ¯ã€‚', 'This creator profile was not found by Scrapin.': 'Scrapin æœªæ‰¾åˆ°æ­¤åˆ›ä½œè€…ä¸»é¡µã€‚', 'Scrapin could not process this profile URL.': 'Scrapin æ— æ³•å¤„ç†æ­¤ä¸»é¡µé“¾æ¥ã€‚', 'Scrapin is rate limiting profile lookups. Try again shortly.': 'Scrapin æš‚æ—¶é™åˆ¶äº†ä¸»é¡µæŸ¥æ‰¾é¢‘ç‡ï¼Œè¯·ç¨åé‡è¯•ã€‚', 'Scrapin took too long to resolve this creator. Try again.': 'Scrapin æŸ¥æ‰¾åˆ›ä½œè€…è¶…æ—¶ï¼Œè¯·é‡è¯•ã€‚', 'Scrapin could not resolve this creator right now.': 'Scrapin æš‚æ—¶æ— æ³•æŸ¥æ‰¾æ­¤åˆ›ä½œè€…ã€‚', 'This social profile URL is not supported.': 'ä¸æ”¯æŒæ­¤ç¤¾äº¤ä¸»é¡µé“¾æ¥ã€‚'
        },
        ko: {
            'COMMUNITY BOARD': 'ì»¤ë®¤ë‹ˆí‹° ìš”ì²­', 'DISCOVER': 'ë‘˜ëŸ¬ë³´ê¸°', 'Find a request': 'ìš”ì²­ ì°¾ê¸°', 'Filter the board': 'ìš”ì²­ í•„í„°ë§',
            'Product details are filled by Scrapin automatically.': 'Scrapinì´ ì œí’ˆ ì •ë³´ë¥¼ ìë™ìœ¼ë¡œ ì…ë ¥í•©ë‹ˆë‹¤.', 'Scrapin is loading product detailsâ€¦': 'Scrapinì´ ì œí’ˆ ì •ë³´ë¥¼ ë¶ˆëŸ¬ì˜¤ëŠ” ì¤‘â€¦',
            'Product details loaded from Scrapin.': 'Scrapinì—ì„œ ì œí’ˆ ì •ë³´ë¥¼ ë¶ˆëŸ¬ì™”ìŠµë‹ˆë‹¤.', 'Scrapin could not read this product link.': 'Scrapinì´ ì´ ì œí’ˆ ë§í¬ë¥¼ ì½ì§€ ëª»í–ˆìŠµë‹ˆë‹¤.', 'Product lookup failed. You can still fill the request manually.': 'ì œí’ˆì„ ì°¾ì§€ ëª»í–ˆìŠµë‹ˆë‹¤. ìš”ì²­ì„ ì§ì ‘ ì‘ì„±í•  ìˆ˜ ìˆìŠµë‹ˆë‹¤.',
            'Step 1: Resolving Profile': '1ë‹¨ê³„: í”„ë¡œí•„ ì°¾ê¸°', 'Fetching creator name & avatar...': 'í¬ë¦¬ì—ì´í„° ì´ë¦„ê³¼ í”„ë¡œí•„ ì‚¬ì§„ì„ ê°€ì ¸ì˜¤ëŠ” ì¤‘â€¦', 'Profile Lookup Failed': 'í”„ë¡œí•„ì„ ì°¾ì§€ ëª»í–ˆìŠµë‹ˆë‹¤', 'Profile Set': 'í”„ë¡œí•„ì´ ì¶”ê°€ë˜ì—ˆìŠµë‹ˆë‹¤', 'Lookup Failed': 'ê²€ìƒ‰ ì‹¤íŒ¨', 'Retry Lookup': 'ë‹¤ì‹œ ê²€ìƒ‰',
            'Scrapin could not resolve this profile right now. You can retry or enter creator details manually.': 'Scrapinì´ ì§€ê¸ˆ ì´ í”„ë¡œí•„ì„ ì°¾ì§€ ëª»í–ˆìŠµë‹ˆë‹¤. ë‹¤ì‹œ ì‹œë„í•˜ê±°ë‚˜ í¬ë¦¬ì—ì´í„° ì •ë³´ë¥¼ ì§ì ‘ ì…ë ¥í•˜ì„¸ìš”.', 'This creator profile was not found by Scrapin.': 'Scrapinì—ì„œ ì´ í¬ë¦¬ì—ì´í„° í”„ë¡œí•„ì„ ì°¾ì§€ ëª»í–ˆìŠµë‹ˆë‹¤.', 'Scrapin could not process this profile URL.': 'Scrapinì´ ì´ í”„ë¡œí•„ ë§í¬ë¥¼ ì²˜ë¦¬í•˜ì§€ ëª»í–ˆìŠµë‹ˆë‹¤.', 'Scrapin is rate limiting profile lookups. Try again shortly.': 'Scrapinì´ í”„ë¡œí•„ ê²€ìƒ‰ì„ ì ì‹œ ì œí•œí•˜ê³  ìˆìŠµë‹ˆë‹¤. ì ì‹œ í›„ ë‹¤ì‹œ ì‹œë„í•˜ì„¸ìš”.', 'Scrapin took too long to resolve this creator. Try again.': 'Scrapinì´ í¬ë¦¬ì—ì´í„° ê²€ìƒ‰ì— ë„ˆë¬´ ì˜¤ë˜ ê±¸ë ¸ìŠµë‹ˆë‹¤. ë‹¤ì‹œ ì‹œë„í•˜ì„¸ìš”.', 'Scrapin could not resolve this creator right now.': 'Scrapinì´ ì§€ê¸ˆ ì´ í¬ë¦¬ì—ì´í„°ë¥¼ ì°¾ì§€ ëª»í–ˆìŠµë‹ˆë‹¤.', 'This social profile URL is not supported.': 'ì§€ì›í•˜ì§€ ì•ŠëŠ” ì†Œì…œ í”„ë¡œí•„ ë§í¬ì…ë‹ˆë‹¤.'
        },
        ar: {
            'COMMUNITY BOARD': 'Ø·Ù„Ø¨Ø§Øª Ø§Ù„Ù…Ø¬ØªÙ…Ø¹', 'DISCOVER': 'Ø§ÙƒØªØ´Ù', 'Find a request': 'Ø§Ø¨Ø­Ø« Ø¹Ù† Ø·Ù„Ø¨', 'Filter the board': 'ØªØµÙÙŠØ© Ø§Ù„Ø·Ù„Ø¨Ø§Øª',
            'Product details are filled by Scrapin automatically.': 'ÙŠÙ…Ù„Ø£ Scrapin ØªÙØ§ØµÙŠÙ„ Ø§Ù„Ù…Ù†ØªØ¬ ØªÙ„Ù‚Ø§Ø¦ÙŠÙ‹Ø§.', 'Scrapin is loading product detailsâ€¦': 'ÙŠØ¬Ø±ÙŠ Scrapin ØªØ­Ù…ÙŠÙ„ ØªÙØ§ØµÙŠÙ„ Ø§Ù„Ù…Ù†ØªØ¬â€¦',
            'Product details loaded from Scrapin.': 'ØªÙ… ØªØ­Ù…ÙŠÙ„ ØªÙØ§ØµÙŠÙ„ Ø§Ù„Ù…Ù†ØªØ¬ Ù…Ù† Scrapin.', 'Scrapin could not read this product link.': 'ØªØ¹Ø°Ø± Ø¹Ù„Ù‰ Scrapin Ù‚Ø±Ø§Ø¡Ø© Ø±Ø§Ø¨Ø· Ø§Ù„Ù…Ù†ØªØ¬ Ù‡Ø°Ø§.', 'Product lookup failed. You can still fill the request manually.': 'ØªØ¹Ø°Ø± Ø§Ù„Ø¹Ø«ÙˆØ± Ø¹Ù„Ù‰ Ø§Ù„Ù…Ù†ØªØ¬. ÙŠÙ…ÙƒÙ†Ùƒ Ø¥Ø¯Ø®Ø§Ù„ Ø§Ù„Ø·Ù„Ø¨ ÙŠØ¯ÙˆÙŠÙ‹Ø§.',
            'Step 1: Resolving Profile': 'Ø§Ù„Ø®Ø·ÙˆØ© 1: Ø§Ù„Ø¨Ø­Ø« Ø¹Ù† Ø§Ù„Ù…Ù„Ù Ø§Ù„Ø´Ø®ØµÙŠ', 'Fetching creator name & avatar...': 'Ø¬Ø§Ø±Ù Ø¬Ù„Ø¨ Ø§Ø³Ù… Ø§Ù„Ù…Ù†Ø´Ø¦ ÙˆØµÙˆØ±ØªÙ‡â€¦', 'Profile Lookup Failed': 'ØªØ¹Ø°Ø± Ø§Ù„Ø¹Ø«ÙˆØ± Ø¹Ù„Ù‰ Ø§Ù„Ù…Ù„Ù Ø§Ù„Ø´Ø®ØµÙŠ', 'Profile Set': 'ØªÙ…Øª Ø¥Ø¶Ø§ÙØ© Ø§Ù„Ù…Ù„Ù Ø§Ù„Ø´Ø®ØµÙŠ', 'Lookup Failed': 'ÙØ´Ù„ Ø§Ù„Ø¨Ø­Ø«', 'Retry Lookup': 'Ø£Ø¹Ø¯ Ø§Ù„Ø¨Ø­Ø«',
            'Scrapin could not resolve this profile right now. You can retry or enter creator details manually.': 'ØªØ¹Ø°Ø± Ø¹Ù„Ù‰ Scrapin Ø§Ù„Ø¹Ø«ÙˆØ± Ø¹Ù„Ù‰ Ù‡Ø°Ø§ Ø§Ù„Ù…Ù„Ù Ø§Ù„Ø¢Ù†. Ø£Ø¹Ø¯ Ø§Ù„Ù…Ø­Ø§ÙˆÙ„Ø© Ø£Ùˆ Ø£Ø¯Ø®Ù„ Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ù…Ù†Ø´Ø¦ ÙŠØ¯ÙˆÙŠÙ‹Ø§.', 'This creator profile was not found by Scrapin.': 'Ù„Ù… ÙŠØ¹Ø«Ø± Scrapin Ø¹Ù„Ù‰ Ù…Ù„Ù Ù‡Ø°Ø§ Ø§Ù„Ù…Ù†Ø´Ø¦.', 'Scrapin could not process this profile URL.': 'ØªØ¹Ø°Ø± Ø¹Ù„Ù‰ Scrapin Ù…Ø¹Ø§Ù„Ø¬Ø© Ø±Ø§Ø¨Ø· Ø§Ù„Ù…Ù„Ù Ø§Ù„Ø´Ø®ØµÙŠ.', 'Scrapin is rate limiting profile lookups. Try again shortly.': 'ÙŠØ­Ø¯ Scrapin Ù…Ø¤Ù‚ØªÙ‹Ø§ Ù…Ù† Ø¹Ù…Ù„ÙŠØ§Øª Ø§Ù„Ø¨Ø­Ø«. Ø­Ø§ÙˆÙ„ Ù…Ø¬Ø¯Ø¯Ù‹Ø§ Ø¨Ø¹Ø¯ Ù‚Ù„ÙŠÙ„.', 'Scrapin took too long to resolve this creator. Try again.': 'Ø§Ø³ØªØºØ±Ù‚ Scrapin ÙˆÙ‚ØªÙ‹Ø§ Ø·ÙˆÙŠÙ„Ù‹Ø§ Ù„Ù„Ø¹Ø«ÙˆØ± Ø¹Ù„Ù‰ Ø§Ù„Ù…Ù†Ø´Ø¦. Ø­Ø§ÙˆÙ„ Ù…Ø¬Ø¯Ø¯Ù‹Ø§.', 'Scrapin could not resolve this creator right now.': 'ØªØ¹Ø°Ø± Ø¹Ù„Ù‰ Scrapin Ø§Ù„Ø¹Ø«ÙˆØ± Ø¹Ù„Ù‰ Ù‡Ø°Ø§ Ø§Ù„Ù…Ù†Ø´Ø¦ Ø§Ù„Ø¢Ù†.', 'This social profile URL is not supported.': 'Ø±Ø§Ø¨Ø· Ø§Ù„Ù…Ù„Ù Ø§Ù„Ø§Ø¬ØªÙ…Ø§Ø¹ÙŠ Ù‡Ø°Ø§ ØºÙŠØ± Ù…Ø¯Ø¹ÙˆÙ….'
        }
    };
    /* Shared legal-page labels. The legal documents use the same site language
       preference as the rest of the app, including when a visitor switches
       language after the page has loaded. */
    var LEGAL_COPY = {
        tr: {'Anonymous Member':'Anonim Ãœye','Anonymous':'Anonim','No description provided':'AÃ§Ä±klama eklenmemiÅŸ','Legal library':'Yasal belgeler','At a glance':'KÄ±sa bilgiler','The short version':'KÄ±saca','The short version: use Zyrex fairly, respect the people who make the things you download, and don\'t turn the platform into a weapon. Everything below is the long version of that sentence.':'KÄ±saca: Zyrexâ€™i adil kullanÄ±n, indirdiÄŸiniz iÃ§erikleri Ã¼reten kiÅŸilere saygÄ± gÃ¶sterin ve platformu kÃ¶tÃ¼ye kullanmayÄ±n. AÅŸaÄŸÄ±da bu yaklaÅŸÄ±mÄ±n ayrÄ±ntÄ±larÄ± yer alÄ±yor.','You should be able to read this in one sitting and know exactly what we store, what we don\'t, and how to ask us to delete it.':'Bu politikayÄ± okuyarak hangi bilgileri sakladÄ±ÄŸÄ±mÄ±zÄ±, hangilerini saklamadÄ±ÄŸÄ±mÄ±zÄ± ve silme talebinde nasÄ±l bulunacaÄŸÄ±nÄ±zÄ± Ã¶ÄŸrenebilirsiniz.','Zyrex indexes leaks, plugins and audios that members upload. We have a clear process for copyright holders to request removal and for uploaders to challenge an incorrect takedown.':'Zyrex, Ã¼yelerin yÃ¼klediÄŸi sÄ±zÄ±ntÄ±larÄ±, eklentileri ve sesleri kataloglar. Telif hakkÄ± sahiplerinin kaldÄ±rma talebi gÃ¶ndermesi ve yÃ¼kleyicilerin hatalÄ± kaldÄ±rmalara itiraz etmesi iÃ§in aÃ§Ä±k bir sÃ¼reÃ§ uygular.','Takedown essentials':'KaldÄ±rma talebinin temel bilgileri','Legal documents':'Yasal belgeler','Updated 25 October 2026':'GÃ¼ncelleme: 25 Ekim 2026','Covers':'Kapsam','Minimum age':'Asgari yaÅŸ','Price':'Ãœcret','Material changes':'Ã–nemli deÄŸiÅŸiklikler','Site, downloads, uploads, Discord':'Site, indirmeler, yÃ¼klemeler ve Discord','Free, supported by optional ad-gated passes':'Ãœcretsiz; isteÄŸe baÄŸlÄ± reklam destekli eriÅŸimlerle','Announced 14 days before they apply':'YÃ¼rÃ¼rlÃ¼ÄŸe girmeden 14 gÃ¼n Ã¶nce duyurulur','Terms':'Åartlar','Privacy':'Gizlilik'},
        es: {'Anonymous Member':'Miembro anÃ³nimo','Anonymous':'AnÃ³nimo','No description provided':'No se proporcionÃ³ ninguna descripciÃ³n','Legal library':'Biblioteca legal','At a glance':'Resumen','The short version':'En resumen','The short version: use Zyrex fairly, respect the people who make the things you download, and don\'t turn the platform into a weapon. Everything below is the long version of that sentence.':'En resumen: usa Zyrex de forma justa, respeta a quienes crean lo que descargas y no utilices la plataforma para hacer daÃ±o. A continuaciÃ³n encontrarÃ¡s todos los detalles.','You should be able to read this in one sitting and know exactly what we store, what we don\'t, and how to ask us to delete it.':'Al leer esta polÃ­tica sabrÃ¡s quÃ© datos guardamos, cuÃ¡les no y cÃ³mo solicitar que los eliminemos.','Zyrex indexes leaks, plugins and audios that members upload. We have a clear process for copyright holders to request removal and for uploaders to challenge an incorrect takedown.':'Zyrex cataloga filtraciones, plugins y audios subidos por miembros. Ofrecemos un proceso claro para solicitar retiradas por derechos de autor y para impugnar las que sean incorrectas.','Takedown essentials':'Datos para solicitar la retirada','Legal documents':'Documentos legales','Updated 25 October 2026':'Actualizado el 25 de octubre de 2026','Covers':'Abarca','Minimum age':'Edad mÃ­nima','Price':'Precio','Material changes':'Cambios importantes','Site, downloads, uploads, Discord':'Sitio, descargas, subidas y Discord','Free, supported by optional ad-gated passes':'Gratis, con pases opcionales financiados por anuncios','Announced 14 days before they apply':'Se anuncian 14 dÃ­as antes de entrar en vigor','Terms':'TÃ©rminos','Privacy':'Privacidad'},
        pt: {'Anonymous Member':'Membro anÃ´nimo','Anonymous':'AnÃ´nimo','No description provided':'Nenhuma descriÃ§Ã£o informada','Legal library':'Biblioteca jurÃ­dica','At a glance':'Resumo','The short version':'Em resumo','The short version: use Zyrex fairly, respect the people who make the things you download, and don\'t turn the platform into a weapon. Everything below is the long version of that sentence.':'Em resumo: use o Zyrex com responsabilidade, respeite quem cria o conteÃºdo que vocÃª baixa e nÃ£o use a plataforma para prejudicar outras pessoas. Abaixo estÃ£o todos os detalhes.','You should be able to read this in one sitting and know exactly what we store, what we don\'t, and how to ask us to delete it.':'Ao ler esta polÃ­tica, vocÃª saberÃ¡ quais dados guardamos, quais nÃ£o guardamos e como solicitar a exclusÃ£o.','Zyrex indexes leaks, plugins and audios that members upload. We have a clear process for copyright holders to request removal and for uploaders to challenge an incorrect takedown.':'O Zyrex cataloga leaks, plugins e Ã¡udios enviados por membros. Temos um processo claro para titulares de direitos autorais solicitarem remoÃ§Ãµes e para quem enviou o conteÃºdo contestar uma remoÃ§Ã£o incorreta.','Takedown essentials':'Dados essenciais para remoÃ§Ã£o','Legal documents':'Documentos jurÃ­dicos','Updated 25 October 2026':'Atualizado em 25 de outubro de 2026','Covers':'Abrange','Minimum age':'Idade mÃ­nima','Price':'PreÃ§o','Material changes':'AlteraÃ§Ãµes importantes','Site, downloads, uploads, Discord':'Site, downloads, envios e Discord','Free, supported by optional ad-gated passes':'GrÃ¡tis, com passes opcionais apoiados por anÃºncios','Announced 14 days before they apply':'Anunciadas 14 dias antes de entrarem em vigor','Terms':'Termos','Privacy':'Privacidade'},
        ru: {'Anonymous Member':'ĞĞ½Ğ¾Ğ½Ğ¸Ğ¼Ğ½Ñ‹Ğ¹ ÑƒÑ‡Ğ°ÑÑ‚Ğ½Ğ¸Ğº','Anonymous':'ĞĞ½Ğ¾Ğ½Ğ¸Ğ¼Ğ½Ğ¾','No description provided':'ĞĞ¿Ğ¸ÑĞ°Ğ½Ğ¸Ğµ Ğ½Ğµ ÑƒĞºĞ°Ğ·Ğ°Ğ½Ğ¾','Legal library':'ĞŸÑ€Ğ°Ğ²Ğ¾Ğ²Ñ‹Ğµ Ğ´Ğ¾ĞºÑƒĞ¼ĞµĞ½Ñ‚Ñ‹','At a glance':'ĞšÑ€Ğ°Ñ‚ĞºĞ¾','The short version':'ĞšĞ¾Ñ€Ğ¾Ñ‚ĞºĞ¾','The short version: use Zyrex fairly, respect the people who make the things you download, and don\'t turn the platform into a weapon. Everything below is the long version of that sentence.':'ĞšÑ€Ğ°Ñ‚ĞºĞ¾: Ğ¿Ğ¾Ğ»ÑŒĞ·ÑƒĞ¹Ñ‚ĞµÑÑŒ Zyrex Ñ‡ĞµÑÑ‚Ğ½Ğ¾, ÑƒĞ²Ğ°Ğ¶Ğ°Ğ¹Ñ‚Ğµ ÑĞ¾Ğ·Ğ´Ğ°Ñ‚ĞµĞ»ĞµĞ¹ ÑĞºĞ°Ñ‡Ğ¸Ğ²Ğ°ĞµĞ¼Ñ‹Ñ… Ğ¼Ğ°Ñ‚ĞµÑ€Ğ¸Ğ°Ğ»Ğ¾Ğ² Ğ¸ Ğ½Ğµ Ğ¸ÑĞ¿Ğ¾Ğ»ÑŒĞ·ÑƒĞ¹Ñ‚Ğµ Ğ¿Ğ»Ğ°Ñ‚Ñ„Ğ¾Ñ€Ğ¼Ñƒ Ğ²Ğ¾ Ğ²Ñ€ĞµĞ´. ĞĞ¸Ğ¶Ğµ Ğ¿Ñ€Ğ¸Ğ²ĞµĞ´ĞµĞ½Ñ‹ Ğ¿Ğ¾Ğ´Ñ€Ğ¾Ğ±Ğ½Ğ¾ÑÑ‚Ğ¸.','You should be able to read this in one sitting and know exactly what we store, what we don\'t, and how to ask us to delete it.':'ĞŸÑ€Ğ¾Ñ‡Ğ¸Ñ‚Ğ°Ğ² ÑÑ‚Ñƒ Ğ¿Ğ¾Ğ»Ğ¸Ñ‚Ğ¸ĞºÑƒ, Ğ²Ñ‹ ÑƒĞ·Ğ½Ğ°ĞµÑ‚Ğµ, ĞºĞ°ĞºĞ¸Ğµ Ğ´Ğ°Ğ½Ğ½Ñ‹Ğµ Ğ¼Ñ‹ Ñ…Ñ€Ğ°Ğ½Ğ¸Ğ¼, ĞºĞ°ĞºĞ¸Ğµ Ğ½Ğµ ÑĞ¾Ğ±Ğ¸Ñ€Ğ°ĞµĞ¼ Ğ¸ ĞºĞ°Ğº Ğ·Ğ°Ğ¿Ñ€Ğ¾ÑĞ¸Ñ‚ÑŒ Ğ¸Ñ… ÑƒĞ´Ğ°Ğ»ĞµĞ½Ğ¸Ğµ.','Zyrex indexes leaks, plugins and audios that members upload. We have a clear process for copyright holders to request removal and for uploaders to challenge an incorrect takedown.':'Zyrex ĞºĞ°Ñ‚Ğ°Ğ»Ğ¾Ğ³Ğ¸Ğ·Ğ¸Ñ€ÑƒĞµÑ‚ ÑĞ»Ğ¸Ğ²Ñ‹, Ğ¿Ğ»Ğ°Ğ³Ğ¸Ğ½Ñ‹ Ğ¸ Ğ°ÑƒĞ´Ğ¸Ğ¾, Ğ·Ğ°Ğ³Ñ€ÑƒĞ¶ĞµĞ½Ğ½Ñ‹Ğµ ÑƒÑ‡Ğ°ÑÑ‚Ğ½Ğ¸ĞºĞ°Ğ¼Ğ¸. Ğ”Ğ»Ñ Ğ¿Ñ€Ğ°Ğ²Ğ¾Ğ¾Ğ±Ğ»Ğ°Ğ´Ğ°Ñ‚ĞµĞ»ĞµĞ¹ Ğ¿Ñ€ĞµĞ´ÑƒÑĞ¼Ğ¾Ñ‚Ñ€ĞµĞ½ Ğ¿Ğ¾Ñ€ÑĞ´Ğ¾Ğº Ğ¿Ğ¾Ğ´Ğ°Ñ‡Ğ¸ Ğ·Ğ°Ğ¿Ñ€Ğ¾ÑĞ¾Ğ² Ğ½Ğ° ÑƒĞ´Ğ°Ğ»ĞµĞ½Ğ¸Ğµ, Ğ° Ğ´Ğ»Ñ Ğ·Ğ°Ğ³Ñ€ÑƒĞ·Ğ¸Ğ²ÑˆĞ¸Ñ… â€” Ğ¾Ğ±Ğ¶Ğ°Ğ»Ğ¾Ğ²Ğ°Ğ½Ğ¸Ñ Ğ¾ÑˆĞ¸Ğ±Ğ¾Ñ‡Ğ½Ğ¾Ğ³Ğ¾ ÑƒĞ´Ğ°Ğ»ĞµĞ½Ğ¸Ñ.','Takedown essentials':'Ğ”Ğ°Ğ½Ğ½Ñ‹Ğµ Ğ´Ğ»Ñ Ğ·Ğ°Ğ¿Ñ€Ğ¾ÑĞ° Ğ½Ğ° ÑƒĞ´Ğ°Ğ»ĞµĞ½Ğ¸Ğµ','Legal documents':'ĞŸÑ€Ğ°Ğ²Ğ¾Ğ²Ñ‹Ğµ Ğ´Ğ¾ĞºÑƒĞ¼ĞµĞ½Ñ‚Ñ‹','Updated 25 October 2026':'ĞĞ±Ğ½Ğ¾Ğ²Ğ»ĞµĞ½Ğ¾ 25 Ğ¾ĞºÑ‚ÑĞ±Ñ€Ñ 2026 Ğ³.','Covers':'ĞÑ…Ğ²Ğ°Ñ‚Ñ‹Ğ²Ğ°ĞµÑ‚','Minimum age':'ĞœĞ¸Ğ½Ğ¸Ğ¼Ğ°Ğ»ÑŒĞ½Ñ‹Ğ¹ Ğ²Ğ¾Ğ·Ñ€Ğ°ÑÑ‚','Price':'Ğ¦ĞµĞ½Ğ°','Material changes':'Ğ’Ğ°Ğ¶Ğ½Ñ‹Ğµ Ğ¸Ğ·Ğ¼ĞµĞ½ĞµĞ½Ğ¸Ñ','Site, downloads, uploads, Discord':'Ğ¡Ğ°Ğ¹Ñ‚, Ğ·Ğ°Ğ³Ñ€ÑƒĞ·ĞºĞ¸, Ğ¿ÑƒĞ±Ğ»Ğ¸ĞºĞ°Ñ†Ğ¸Ğ¸ Ğ¸ Discord','Free, supported by optional ad-gated passes':'Ğ‘ĞµÑĞ¿Ğ»Ğ°Ñ‚Ğ½Ğ¾; Ğ´Ğ¾ÑÑ‚ÑƒĞ¿Ğ½Ñ‹ Ğ´Ğ¾Ğ¿Ğ¾Ğ»Ğ½Ğ¸Ñ‚ĞµĞ»ÑŒĞ½Ñ‹Ğµ Ğ¿Ñ€Ğ¾Ğ¿ÑƒÑĞºĞ° Ñ Ñ€ĞµĞºĞ»Ğ°Ğ¼Ğ¾Ğ¹','Announced 14 days before they apply':'ĞĞ±ÑŠÑĞ²Ğ»ÑÑÑ‚ÑÑ Ğ·Ğ° 14 Ğ´Ğ½ĞµĞ¹ Ğ´Ğ¾ Ğ²ÑÑ‚ÑƒĞ¿Ğ»ĞµĞ½Ğ¸Ñ Ğ² ÑĞ¸Ğ»Ñƒ','Terms':'Ğ£ÑĞ»Ğ¾Ğ²Ğ¸Ñ','Privacy':'ĞšĞ¾Ğ½Ñ„Ğ¸Ğ´ĞµĞ½Ñ†Ğ¸Ğ°Ğ»ÑŒĞ½Ğ¾ÑÑ‚ÑŒ'},
        ko: {'Anonymous Member':'ìµëª… íšŒì›','Anonymous':'ìµëª…','No description provided':'ì„¤ëª…ì´ ì—†ìŠµë‹ˆë‹¤','Legal library':'ë²•ë¥  ë¬¸ì„œ','At a glance':'ìš”ì•½','The short version':'ê°„ë‹¨íˆ ë³´ê¸°','The short version: use Zyrex fairly, respect the people who make the things you download, and don\'t turn the platform into a weapon. Everything below is the long version of that sentence.':'ê°„ë‹¨íˆ ë§í•´ Zyrexë¥¼ ê³µì •í•˜ê²Œ ì´ìš©í•˜ê³ , ë‹¤ìš´ë¡œë“œí•œ ìë£Œì˜ ì œì‘ìë¥¼ ì¡´ì¤‘í•˜ë©°, í”Œë«í¼ì„ ì•…ìš©í•˜ì§€ ë§ˆì„¸ìš”. ìì„¸í•œ ë‚´ìš©ì€ ì•„ë˜ì— ì„¤ëª…ë˜ì–´ ìˆìŠµë‹ˆë‹¤.','You should be able to read this in one sitting and know exactly what we store, what we don\'t, and how to ask us to delete it.':'ì´ ì •ì±…ì—ì„œ ë‹¹ì‚¬ê°€ ì €ì¥í•˜ëŠ” ì •ë³´ì™€ ì €ì¥í•˜ì§€ ì•ŠëŠ” ì •ë³´, ì‚­ì œë¥¼ ìš”ì²­í•˜ëŠ” ë°©ë²•ì„ í™•ì¸í•  ìˆ˜ ìˆìŠµë‹ˆë‹¤.','Zyrex indexes leaks, plugins and audios that members upload. We have a clear process for copyright holders to request removal and for uploaders to challenge an incorrect takedown.':'ZyrexëŠ” íšŒì›ì´ ì—…ë¡œë“œí•œ ìœ ì¶œ ìë£Œ, í”ŒëŸ¬ê·¸ì¸, ì˜¤ë””ì˜¤ë¥¼ ë¶„ë¥˜í•©ë‹ˆë‹¤. ì €ì‘ê¶Œìì˜ ì‚­ì œ ìš”ì²­ê³¼ ì—…ë¡œë”ì˜ ì˜ëª»ëœ ì‚­ì œ ì¡°ì¹˜ ì´ì˜ ì œê¸°ë¥¼ ìœ„í•œ ì ˆì°¨ë¥¼ ìš´ì˜í•©ë‹ˆë‹¤.','Takedown essentials':'ì‚­ì œ ìš”ì²­ í•„ìˆ˜ ì •ë³´','Legal documents':'ë²•ë¥  ë¬¸ì„œ','Updated 25 October 2026':'2026ë…„ 10ì›” 25ì¼ ì—…ë°ì´íŠ¸','Covers':'ì ìš© ë²”ìœ„','Minimum age':'ìµœì†Œ ì—°ë ¹','Price':'ê°€ê²©','Material changes':'ì¤‘ìš” ë³€ê²½ ì‚¬í•­','Site, downloads, uploads, Discord':'ì‚¬ì´íŠ¸, ë‹¤ìš´ë¡œë“œ, ì—…ë¡œë“œ, Discord','Free, supported by optional ad-gated passes':'ë¬´ë£Œì´ë©° ì„ íƒí˜• ê´‘ê³  ì§€ì› ì´ìš©ê¶Œ ì œê³µ','Announced 14 days before they apply':'ì‹œí–‰ 14ì¼ ì „ì— ê³µì§€','Terms':'ì•½ê´€','Privacy':'ê°œì¸ì •ë³´'},
        zh: {'Anonymous Member':'åŒ¿åæˆå‘˜','Anonymous':'åŒ¿å','No description provided':'æœªæä¾›æè¿°','Legal library':'æ³•å¾‹æ–‡ä»¶','At a glance':'æ¦‚è¦','The short version':'ç®€è¦è¯´æ˜','The short version: use Zyrex fairly, respect the people who make the things you download, and don\'t turn the platform into a weapon. Everything below is the long version of that sentence.':'ç®€è€Œè¨€ä¹‹ï¼šå…¬å¹³ä½¿ç”¨ Zyrexï¼Œå°Šé‡ä½ ä¸‹è½½å†…å®¹çš„åˆ›ä½œè€…ï¼Œä¸è¦æ»¥ç”¨å¹³å°ã€‚ä¸‹æ–‡å°†è¯¦ç»†è¯´æ˜è¿™äº›è¦æ±‚ã€‚','You should be able to read this in one sitting and know exactly what we store, what we don\'t, and how to ask us to delete it.':'é˜…è¯»æœ¬æ”¿ç­–åï¼Œä½ å¯ä»¥äº†è§£æˆ‘ä»¬ä¿å­˜å’Œä¸ä¿å­˜å“ªäº›ä¿¡æ¯ï¼Œä»¥åŠå¦‚ä½•ç”³è¯·åˆ é™¤ã€‚','Zyrex indexes leaks, plugins and audios that members upload. We have a clear process for copyright holders to request removal and for uploaders to challenge an incorrect takedown.':'Zyrex å¯¹ä¼šå‘˜ä¸Šä¼ çš„æ³„æ¼å†…å®¹ã€æ’ä»¶å’ŒéŸ³é¢‘è¿›è¡Œç¼–ç›®ã€‚æˆ‘ä»¬ä¸ºç‰ˆæƒæ‰€æœ‰è€…æä¾›æ˜ç¡®çš„åˆ é™¤ç”³è¯·æµç¨‹ï¼Œä¹Ÿå…è®¸ä¸Šä¼ è€…å¯¹é”™è¯¯çš„åˆ é™¤æå‡ºå¼‚è®®ã€‚','Takedown essentials':'ä¸‹æ¶ç”³è¯·å¿…å¤‡ä¿¡æ¯','Legal documents':'æ³•å¾‹æ–‡ä»¶','Updated 25 October 2026':'æ›´æ–°äº 2026 å¹´ 10 æœˆ 25 æ—¥','Covers':'é€‚ç”¨èŒƒå›´','Minimum age':'æœ€ä½å¹´é¾„','Price':'ä»·æ ¼','Material changes':'é‡å¤§å˜æ›´','Site, downloads, uploads, Discord':'ç½‘ç«™ã€ä¸‹è½½ã€ä¸Šä¼ å’Œ Discord','Free, supported by optional ad-gated passes':'å…è´¹ï¼Œå¦æä¾›å¯é€‰å¹¿å‘Šæ”¯æŒé€šè¡Œè¯','Announced 14 days before they apply':'ç”Ÿæ•ˆå‰ 14 å¤©å…¬å¸ƒ','Terms':'æ¡æ¬¾','Privacy':'éšç§'},
        ar: {'Anonymous Member':'Ø¹Ø¶Ùˆ Ù…Ø¬Ù‡ÙˆÙ„','Anonymous':'Ù…Ø¬Ù‡ÙˆÙ„','No description provided':'Ù„Ù… ÙŠØªÙ… ØªÙ‚Ø¯ÙŠÙ… ÙˆØµÙ','Legal library':'Ø§Ù„Ù…ÙƒØªØ¨Ø© Ø§Ù„Ù‚Ø§Ù†ÙˆÙ†ÙŠØ©','At a glance':'Ù†Ø¸Ø±Ø© Ø³Ø±ÙŠØ¹Ø©','The short version':'Ø¨Ø§Ø®ØªØµØ§Ø±','The short version: use Zyrex fairly, respect the people who make the things you download, and don\'t turn the platform into a weapon. Everything below is the long version of that sentence.':'Ø¨Ø§Ø®ØªØµØ§Ø±: Ø§Ø³ØªØ®Ø¯Ù… Zyrex Ø¨Ù†Ø²Ø§Ù‡Ø©ØŒ ÙˆØ§Ø­ØªØ±Ù… ØµØ§Ù†Ø¹ÙŠ Ø§Ù„Ù…ÙˆØ§Ø¯ Ø§Ù„ØªÙŠ ØªÙ†Ø²Ù‘Ù„Ù‡Ø§ØŒ ÙˆÙ„Ø§ ØªÙØ³Ø¦ Ø§Ø³ØªØ®Ø¯Ø§Ù… Ø§Ù„Ù…Ù†ØµØ©. ØªÙˆØ¶Ø­ Ø§Ù„Ø£Ù‚Ø³Ø§Ù… Ø§Ù„ØªØ§Ù„ÙŠØ© Ø§Ù„ØªÙØ§ØµÙŠÙ„.','You should be able to read this in one sitting and know exactly what we store, what we don\'t, and how to ask us to delete it.':'ØªÙˆØ¶Ø­ Ù‡Ø°Ù‡ Ø§Ù„Ø³ÙŠØ§Ø³Ø© Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„ØªÙŠ Ù†Ø­ØªÙØ¸ Ø¨Ù‡Ø§ ÙˆØ§Ù„ØªÙŠ Ù„Ø§ Ù†Ø­ØªÙØ¸ Ø¨Ù‡Ø§ØŒ ÙˆÙƒÙŠÙÙŠØ© Ø·Ù„Ø¨ Ø­Ø°ÙÙ‡Ø§.','Zyrex indexes leaks, plugins and audios that members upload. We have a clear process for copyright holders to request removal and for uploaders to challenge an incorrect takedown.':'ÙŠÙÙ‡Ø±Ø³ Zyrex Ø§Ù„ØªØ³Ø±ÙŠØ¨Ø§Øª ÙˆØ§Ù„Ø¥Ø¶Ø§ÙØ§Øª ÙˆØ§Ù„Ù…Ù„ÙØ§Øª Ø§Ù„ØµÙˆØªÙŠØ© Ø§Ù„ØªÙŠ ÙŠØ±ÙØ¹Ù‡Ø§ Ø§Ù„Ø£Ø¹Ø¶Ø§Ø¡. Ù„Ø¯ÙŠÙ†Ø§ Ø¥Ø¬Ø±Ø§Ø¡Ø§Øª ÙˆØ§Ø¶Ø­Ø© Ù„Ø·Ù„Ø¨Ø§Øª Ø§Ù„Ø¥Ø²Ø§Ù„Ø© Ù…Ù† Ø£ØµØ­Ø§Ø¨ Ø§Ù„Ø­Ù‚ÙˆÙ‚ ÙˆÙ„Ù„Ø§Ø¹ØªØ±Ø§Ø¶ Ø¹Ù„Ù‰ Ø§Ù„Ø¥Ø²Ø§Ù„Ø© Ø§Ù„Ø®Ø§Ø·Ø¦Ø©.','Takedown essentials':'Ø§Ù„Ù…Ø¹Ù„ÙˆÙ…Ø§Øª Ø§Ù„Ù„Ø§Ø²Ù…Ø© Ù„Ø·Ù„Ø¨ Ø§Ù„Ø¥Ø²Ø§Ù„Ø©','Legal documents':'Ø§Ù„Ù…Ø³ØªÙ†Ø¯Ø§Øª Ø§Ù„Ù‚Ø§Ù†ÙˆÙ†ÙŠØ©','Updated 25 October 2026':'Ø¢Ø®Ø± ØªØ­Ø¯ÙŠØ«: 25 Ø£ÙƒØªÙˆØ¨Ø± 2026','Covers':'ÙŠØ´Ù…Ù„','Minimum age':'Ø§Ù„Ø­Ø¯ Ø§Ù„Ø£Ø¯Ù†Ù‰ Ù„Ù„Ø¹Ù…Ø±','Price':'Ø§Ù„Ø³Ø¹Ø±','Material changes':'Ø§Ù„ØªØºÙŠÙŠØ±Ø§Øª Ø§Ù„Ù…Ù‡Ù…Ø©','Site, downloads, uploads, Discord':'Ø§Ù„Ù…ÙˆÙ‚Ø¹ ÙˆØ§Ù„ØªÙ†Ø²ÙŠÙ„Ø§Øª ÙˆØ§Ù„Ø±ÙØ¹ ÙˆDiscord','Free, supported by optional ad-gated passes':'Ù…Ø¬Ø§Ù†ÙŠ Ù…Ø¹ ØªØµØ§Ø±ÙŠØ­ Ø§Ø®ØªÙŠØ§Ø±ÙŠØ© Ù…Ø¯Ø¹ÙˆÙ…Ø© Ø¨Ø§Ù„Ø¥Ø¹Ù„Ø§Ù†Ø§Øª','Announced 14 days before they apply':'ÙŠÙØ¹Ù„Ù† Ø¹Ù†Ù‡Ø§ Ù‚Ø¨Ù„ 14 ÙŠÙˆÙ…Ù‹Ø§ Ù…Ù† Ø³Ø±ÙŠØ§Ù†Ù‡Ø§','Terms':'Ø§Ù„Ø´Ø±ÙˆØ·','Privacy':'Ø§Ù„Ø®ØµÙˆØµÙŠØ©'}
    };
    Object.keys(LEGAL_COPY).forEach(function (code) { Object.assign(PAGE_COPY[code], LEGAL_COPY[code]); });
    var LEGAL_EXTRA_COPY = {
        tr: {
            'The short version: use Zyrex fairly, respect the people who make the things you download, and don\'t turn the platform into a weapon. Everything below is the long version of that sentence.': 'KÄ±saca: Zyrexâ€™i adil kullanÄ±n, indirdiÄŸiniz iÃ§erikleri Ã¼reten kiÅŸilere saygÄ± gÃ¶sterin ve platformu kÃ¶tÃ¼ye kullanmayÄ±n. AÅŸaÄŸÄ±da bu yaklaÅŸÄ±mÄ±n ayrÄ±ntÄ±larÄ± yer alÄ±yor.',
            'You should be able to read this in one sitting and know exactly where you stand. Here is what Zyrex stores, why it exists, how long it stays, and how to have it erased.': 'Bu politikayÄ± okuyarak hangi bilgileri sakladÄ±ÄŸÄ±mÄ±zÄ±, bunlarÄ± neden kullandÄ±ÄŸÄ±mÄ±zÄ±, ne kadar sÃ¼re tuttuÄŸumuzu ve nasÄ±l sildirebileceÄŸinizi Ã¶ÄŸrenebilirsiniz.',
            'Zyrex indexes leaks, plugins and audios that members upload. We don\'t pretend otherwise â€” and we don\'t hide behind it. If something here is yours and you want it gone, one clear notice is all it takes.': 'Zyrex Ã¼yelerin yÃ¼klediÄŸi sÄ±zÄ±ntÄ±larÄ±, eklentileri ve sesleri kataloglar. Bu durumu gizlemiyoruz. Buradaki bir iÃ§erik size aitse ve kaldÄ±rÄ±lmasÄ±nÄ± istiyorsanÄ±z, aÃ§Ä±k bir bildirim gÃ¶ndermeniz yeterlidir.',
            'Translations are provided for convenience; the English version controls if there is a discrepancy.': 'Ã‡eviriler kolaylÄ±k saÄŸlamak amacÄ±yla sunulmuÅŸtur; farklÄ±lÄ±k olmasÄ± hÃ¢linde Ä°ngilizce metin esas alÄ±nÄ±r.'
        },
        es: {
            'The short version: use Zyrex fairly, respect the people who make the things you download, and don\'t turn the platform into a weapon. Everything below is the long version of that sentence.': 'En resumen: usa Zyrex de forma justa, respeta a quienes crean lo que descargas y no utilices la plataforma para hacer daÃ±o. A continuaciÃ³n encontrarÃ¡s todos los detalles.',
            'You should be able to read this in one sitting and know exactly where you stand. Here is what Zyrex stores, why it exists, how long it stays, and how to have it erased.': 'Al leer esta polÃ­tica sabrÃ¡s quÃ© datos guarda Zyrex, por quÃ©, durante cuÃ¡nto tiempo y cÃ³mo solicitar que se eliminen.',
            'Zyrex indexes leaks, plugins and audios that members upload. We don\'t pretend otherwise â€” and we don\'t hide behind it. If something here is yours and you want it gone, one clear notice is all it takes.': 'Zyrex cataloga filtraciones, plugins y audios que suben sus miembros. No lo ocultamos. Si algo de aquÃ­ te pertenece y quieres que lo retiremos, basta con enviar una notificaciÃ³n clara.',
            'Translations are provided for convenience; the English version controls if there is a discrepancy.': 'Las traducciones se ofrecen a modo informativo; en caso de discrepancia, prevalece el texto en inglÃ©s.'
        },
        pt: {
            'The short version: use Zyrex fairly, respect the people who make the things you download, and don\'t turn the platform into a weapon. Everything below is the long version of that sentence.': 'Em resumo: use o Zyrex com responsabilidade, respeite quem cria o conteÃºdo que vocÃª baixa e nÃ£o use a plataforma para prejudicar outras pessoas. Abaixo estÃ£o todos os detalhes.',
            'You should be able to read this in one sitting and know exactly where you stand. Here is what Zyrex stores, why it exists, how long it stays, and how to have it erased.': 'Ao ler esta polÃ­tica, vocÃª saberÃ¡ quais dados o Zyrex guarda, por que os guarda, por quanto tempo e como solicitar a exclusÃ£o.',
            'Zyrex indexes leaks, plugins and audios that members upload. We don\'t pretend otherwise â€” and we don\'t hide behind it. If something here is yours and you want it gone, one clear notice is all it takes.': 'O Zyrex cataloga leaks, plugins e Ã¡udios enviados pelos membros. NÃ£o escondemos isso. Se algum conteÃºdo aqui Ã© seu e vocÃª quer removÃª-lo, basta enviar uma notificaÃ§Ã£o clara.',
            'Translations are provided for convenience; the English version controls if there is a discrepancy.': 'As traduÃ§Ãµes sÃ£o fornecidas por conveniÃªncia; em caso de divergÃªncia, prevalece o texto em inglÃªs.'
        },
        ru: {
            'The short version: use Zyrex fairly, respect the people who make the things you download, and don\'t turn the platform into a weapon. Everything below is the long version of that sentence.': 'ĞšÑ€Ğ°Ñ‚ĞºĞ¾: Ğ¿Ğ¾Ğ»ÑŒĞ·ÑƒĞ¹Ñ‚ĞµÑÑŒ Zyrex Ñ‡ĞµÑÑ‚Ğ½Ğ¾, ÑƒĞ²Ğ°Ğ¶Ğ°Ğ¹Ñ‚Ğµ ÑĞ¾Ğ·Ğ´Ğ°Ñ‚ĞµĞ»ĞµĞ¹ ÑĞºĞ°Ñ‡Ğ¸Ğ²Ğ°ĞµĞ¼Ñ‹Ñ… Ğ¼Ğ°Ñ‚ĞµÑ€Ğ¸Ğ°Ğ»Ğ¾Ğ² Ğ¸ Ğ½Ğµ Ğ¸ÑĞ¿Ğ¾Ğ»ÑŒĞ·ÑƒĞ¹Ñ‚Ğµ Ğ¿Ğ»Ğ°Ñ‚Ñ„Ğ¾Ñ€Ğ¼Ñƒ Ğ²Ğ¾ Ğ²Ñ€ĞµĞ´. ĞĞ¸Ğ¶Ğµ Ğ¿Ñ€Ğ¸Ğ²ĞµĞ´ĞµĞ½Ñ‹ Ğ¿Ğ¾Ğ´Ñ€Ğ¾Ğ±Ğ½Ğ¾ÑÑ‚Ğ¸.',
            'You should be able to read this in one sitting and know exactly where you stand. Here is what Zyrex stores, why it exists, how long it stays, and how to have it erased.': 'ĞŸÑ€Ğ¾Ñ‡Ğ¸Ñ‚Ğ°Ğ² ÑÑ‚Ñƒ Ğ¿Ğ¾Ğ»Ğ¸Ñ‚Ğ¸ĞºÑƒ, Ğ²Ñ‹ ÑƒĞ·Ğ½Ğ°ĞµÑ‚Ğµ, ĞºĞ°ĞºĞ¸Ğµ Ğ´Ğ°Ğ½Ğ½Ñ‹Ğµ Ñ…Ñ€Ğ°Ğ½Ğ¸Ñ‚ Zyrex, Ğ·Ğ°Ñ‡ĞµĞ¼ Ğ¸ ĞºĞ°Ğº Ğ´Ğ¾Ğ»Ğ³Ğ¾, Ğ° Ñ‚Ğ°ĞºĞ¶Ğµ ĞºĞ°Ğº Ğ·Ğ°Ğ¿Ñ€Ğ¾ÑĞ¸Ñ‚ÑŒ Ğ¸Ñ… ÑƒĞ´Ğ°Ğ»ĞµĞ½Ğ¸Ğµ.',
            'Zyrex indexes leaks, plugins and audios that members upload. We don\'t pretend otherwise â€” and we don\'t hide behind it. If something here is yours and you want it gone, one clear notice is all it takes.': 'Zyrex ĞºĞ°Ñ‚Ğ°Ğ»Ğ¾Ğ³Ğ¸Ğ·Ğ¸Ñ€ÑƒĞµÑ‚ ÑĞ»Ğ¸Ğ²Ñ‹, Ğ¿Ğ»Ğ°Ğ³Ğ¸Ğ½Ñ‹ Ğ¸ Ğ°ÑƒĞ´Ğ¸Ğ¾, Ğ·Ğ°Ğ³Ñ€ÑƒĞ¶ĞµĞ½Ğ½Ñ‹Ğµ ÑƒÑ‡Ğ°ÑÑ‚Ğ½Ğ¸ĞºĞ°Ğ¼Ğ¸. ĞœÑ‹ ÑÑ‚Ğ¾Ğ³Ğ¾ Ğ½Ğµ ÑĞºÑ€Ñ‹Ğ²Ğ°ĞµĞ¼. Ğ•ÑĞ»Ğ¸ Ğ¼Ğ°Ñ‚ĞµÑ€Ğ¸Ğ°Ğ» Ğ¿Ñ€Ğ¸Ğ½Ğ°Ğ´Ğ»ĞµĞ¶Ğ¸Ñ‚ Ğ²Ğ°Ğ¼ Ğ¸ Ğ²Ñ‹ Ñ…Ğ¾Ñ‚Ğ¸Ñ‚Ğµ ĞµĞ³Ğ¾ ÑƒĞ´Ğ°Ğ»Ğ¸Ñ‚ÑŒ, Ğ¾Ñ‚Ğ¿Ñ€Ğ°Ğ²ÑŒÑ‚Ğµ Ğ½Ğ°Ğ¼ ÑÑĞ½Ğ¾Ğµ ÑƒĞ²ĞµĞ´Ğ¾Ğ¼Ğ»ĞµĞ½Ğ¸Ğµ.',
            'Translations are provided for convenience; the English version controls if there is a discrepancy.': 'ĞŸĞµÑ€ĞµĞ²Ğ¾Ğ´Ñ‹ Ğ¿Ñ€ĞµĞ´Ğ¾ÑÑ‚Ğ°Ğ²Ğ»ĞµĞ½Ñ‹ Ğ´Ğ»Ñ ÑƒĞ´Ğ¾Ğ±ÑÑ‚Ğ²Ğ°; Ğ¿Ñ€Ğ¸ Ñ€Ğ°ÑÑ…Ğ¾Ğ¶Ğ´ĞµĞ½Ğ¸ÑÑ… Ğ¿Ñ€ĞµĞ¸Ğ¼ÑƒÑ‰ĞµÑÑ‚Ğ²ĞµĞ½Ğ½ÑƒÑ ÑĞ¸Ğ»Ñƒ Ğ¸Ğ¼ĞµĞµÑ‚ Ñ‚ĞµĞºÑÑ‚ Ğ½Ğ° Ğ°Ğ½Ğ³Ğ»Ğ¸Ğ¹ÑĞºĞ¾Ğ¼ ÑĞ·Ñ‹ĞºĞµ.'
        },
        ko: {
            'The short version: use Zyrex fairly, respect the people who make the things you download, and don\'t turn the platform into a weapon. Everything below is the long version of that sentence.': 'ê°„ë‹¨íˆ ë§í•´ Zyrexë¥¼ ê³µì •í•˜ê²Œ ì´ìš©í•˜ê³ , ë‹¤ìš´ë¡œë“œí•œ ìë£Œì˜ ì œì‘ìë¥¼ ì¡´ì¤‘í•˜ë©°, í”Œë«í¼ì„ ì•…ìš©í•˜ì§€ ë§ˆì„¸ìš”. ìì„¸í•œ ë‚´ìš©ì€ ì•„ë˜ì— ì„¤ëª…ë˜ì–´ ìˆìŠµë‹ˆë‹¤.',
            'You should be able to read this in one sitting and know exactly where you stand. Here is what Zyrex stores, why it exists, how long it stays, and how to have it erased.': 'ì´ ì •ì±…ì—ì„œ Zyrexê°€ ì–´ë–¤ ì •ë³´ë¥¼ ì™œ, ì–¼ë§ˆë‚˜ ì˜¤ë˜ ë³´ê´€í•˜ëŠ”ì§€ì™€ ì‚­ì œë¥¼ ìš”ì²­í•˜ëŠ” ë°©ë²•ì„ í™•ì¸í•  ìˆ˜ ìˆìŠµë‹ˆë‹¤.',
            'Zyrex indexes leaks, plugins and audios that members upload. We don\'t pretend otherwise â€” and we don\'t hide behind it. If something here is yours and you want it gone, one clear notice is all it takes.': 'ZyrexëŠ” íšŒì›ì´ ì˜¬ë¦° ìœ ì¶œ ìë£Œ, í”ŒëŸ¬ê·¸ì¸, ì˜¤ë””ì˜¤ë¥¼ ë¶„ë¥˜í•©ë‹ˆë‹¤. ì´ë¥¼ ìˆ¨ê¸°ì§€ ì•ŠìŠµë‹ˆë‹¤. ì—¬ê¸° ìˆëŠ” ìë£Œê°€ ë³¸ì¸ ì†Œìœ ì´ê³  ì‚­ì œë¥¼ ì›í•œë‹¤ë©´ ëª…í™•í•œ í†µì§€ë¥¼ ë³´ë‚´ ì£¼ì„¸ìš”.',
            'Translations are provided for convenience; the English version controls if there is a discrepancy.': 'ë²ˆì—­ì€ í¸ì˜ë¥¼ ìœ„í•´ ì œê³µë©ë‹ˆë‹¤. ë²ˆì—­ ë‚´ìš©ì´ ë‹¤ë¥¼ ê²½ìš° ì˜ì–´ ì›ë¬¸ì´ ìš°ì„ í•©ë‹ˆë‹¤.'
        },
        zh: {
            'The short version: use Zyrex fairly, respect the people who make the things you download, and don\'t turn the platform into a weapon. Everything below is the long version of that sentence.': 'ç®€è€Œè¨€ä¹‹ï¼šå…¬å¹³ä½¿ç”¨ Zyrexï¼Œå°Šé‡ä½ ä¸‹è½½å†…å®¹çš„åˆ›ä½œè€…ï¼Œä¸è¦æ»¥ç”¨å¹³å°ã€‚ä¸‹æ–‡å°†è¯¦ç»†è¯´æ˜è¿™äº›è¦æ±‚ã€‚',
            'You should be able to read this in one sitting and know exactly where you stand. Here is what Zyrex stores, why it exists, how long it stays, and how to have it erased.': 'é˜…è¯»æœ¬æ”¿ç­–åï¼Œä½ å¯ä»¥äº†è§£ Zyrex ä¿å­˜å“ªäº›ä¿¡æ¯ã€ä¿å­˜åŸå› å’ŒæœŸé™ï¼Œä»¥åŠå¦‚ä½•ç”³è¯·åˆ é™¤ã€‚',
            'Zyrex indexes leaks, plugins and audios that members upload. We don\'t pretend otherwise â€” and we don\'t hide behind it. If something here is yours and you want it gone, one clear notice is all it takes.': 'Zyrex å¯¹ä¼šå‘˜ä¸Šä¼ çš„æ³„æ¼å†…å®¹ã€æ’ä»¶å’ŒéŸ³é¢‘è¿›è¡Œç¼–ç›®ã€‚æˆ‘ä»¬å¯¹æ­¤ä¸ä½œæ©é¥°ã€‚å¦‚æœè¿™é‡Œçš„å†…å®¹å±äºä½ ä¸”å¸Œæœ›åˆ é™¤ï¼Œè¯·æäº¤ä¸€ä»½æ˜ç¡®çš„é€šçŸ¥ã€‚',
            'Translations are provided for convenience; the English version controls if there is a discrepancy.': 'è¯‘æ–‡ä»…ä¸ºæ–¹ä¾¿é˜…è¯»è€Œæä¾›ï¼›å¦‚æœ‰å·®å¼‚ï¼Œä»¥è‹±æ–‡åŸæ–‡ä¸ºå‡†ã€‚'
        },
        ar: {
            'The short version: use Zyrex fairly, respect the people who make the things you download, and don\'t turn the platform into a weapon. Everything below is the long version of that sentence.': 'Ø¨Ø§Ø®ØªØµØ§Ø±: Ø§Ø³ØªØ®Ø¯Ù… Zyrex Ø¨Ù†Ø²Ø§Ù‡Ø©ØŒ ÙˆØ§Ø­ØªØ±Ù… ØµØ§Ù†Ø¹ÙŠ Ø§Ù„Ù…ÙˆØ§Ø¯ Ø§Ù„ØªÙŠ ØªÙ†Ø²Ù‘Ù„Ù‡Ø§ØŒ ÙˆÙ„Ø§ ØªÙØ³Ø¦ Ø§Ø³ØªØ®Ø¯Ø§Ù… Ø§Ù„Ù…Ù†ØµØ©. ØªÙˆØ¶Ø­ Ø§Ù„Ø£Ù‚Ø³Ø§Ù… Ø§Ù„ØªØ§Ù„ÙŠØ© Ø§Ù„ØªÙØ§ØµÙŠÙ„.',
            'You should be able to read this in one sitting and know exactly where you stand. Here is what Zyrex stores, why it exists, how long it stays, and how to have it erased.': 'ØªÙˆØ¶Ø­ Ù‡Ø°Ù‡ Ø§Ù„Ø³ÙŠØ§Ø³Ø© Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„ØªÙŠ ÙŠØ­ØªÙØ¸ Ø¨Ù‡Ø§ Zyrex ÙˆØ£Ø³Ø¨Ø§Ø¨ Ø§Ù„Ø§Ø­ØªÙØ§Ø¸ Ø¨Ù‡Ø§ ÙˆÙ…Ø¯ØªÙ‡ØŒ ÙˆÙƒÙŠÙÙŠØ© Ø·Ù„Ø¨ Ø­Ø°ÙÙ‡Ø§.',
            'Zyrex indexes leaks, plugins and audios that members upload. We don\'t pretend otherwise â€” and we don\'t hide behind it. If something here is yours and you want it gone, one clear notice is all it takes.': 'ÙŠÙÙ‡Ø±Ø³ Zyrex Ø§Ù„ØªØ³Ø±ÙŠØ¨Ø§Øª ÙˆØ§Ù„Ø¥Ø¶Ø§ÙØ§Øª ÙˆØ§Ù„Ù…Ù„ÙØ§Øª Ø§Ù„ØµÙˆØªÙŠØ© Ø§Ù„ØªÙŠ ÙŠØ±ÙØ¹Ù‡Ø§ Ø§Ù„Ø£Ø¹Ø¶Ø§Ø¡ØŒ ÙˆÙ„Ø§ Ù†Ø®ÙÙŠ Ø°Ù„Ùƒ. Ø¥Ø°Ø§ ÙƒØ§Ù† Ù…Ø­ØªÙˆÙ‰ Ù‡Ù†Ø§ Ù…Ù„ÙƒÙ‹Ø§ Ù„Ùƒ ÙˆØªØ±ÙŠØ¯ Ø¥Ø²Ø§Ù„ØªÙ‡ØŒ ÙØ£Ø±Ø³Ù„ Ø¥Ø´Ø¹Ø§Ø±Ù‹Ø§ ÙˆØ§Ø¶Ø­Ù‹Ø§.',
            'Translations are provided for convenience; the English version controls if there is a discrepancy.': 'ØªÙÙ‚Ø¯Ù‘ÙÙ… Ø§Ù„ØªØ±Ø¬Ù…Ø§Øª Ù„Ù„ØªÙŠØ³ÙŠØ±Ø› ÙˆØ¹Ù†Ø¯ ÙˆØ¬ÙˆØ¯ Ø§Ø®ØªÙ„Ø§Ù ÙŠÙØ¹ØªØ¯ Ø¨Ø§Ù„Ù†Øµ Ø§Ù„Ø¥Ù†Ø¬Ù„ÙŠØ²ÙŠ.'
        }
    };
    Object.keys(LEGAL_EXTRA_COPY).forEach(function (code) { Object.assign(PAGE_COPY[code], LEGAL_EXTRA_COPY[code]); });

    Object.assign(PAGE_COPY.tr, {
        'Partner / File Converter': 'Ortak / Dosya DÃ¶nÃ¼ÅŸtÃ¼rÃ¼cÃ¼',
        'Convert files that do not match your software version and make them compatible with Helix Converter.': 'YazÄ±lÄ±m sÃ¼rÃ¼mÃ¼nÃ¼zle uyuÅŸmayan dosyalarÄ± Helix Converter ile uyumlu hÃ¢le getirin.',
        'Download Helix Converter': 'Helix Converterâ€™Ä± indir'
    });
    Object.assign(PAGE_COPY.es, {
        'Partner / File Converter': 'Socio / Conversor de archivos',
        'Convert files that do not match your software version and make them compatible with Helix Converter.': 'Convierte archivos incompatibles con tu versiÃ³n de software usando Helix Converter.',
        'Download Helix Converter': 'Descargar Helix Converter'
    });
    Object.assign(PAGE_COPY.pt, {
        'Partner / File Converter': 'Parceiro / Conversor de arquivos',
        'Convert files that do not match your software version and make them compatible with Helix Converter.': 'Converta arquivos incompatÃ­veis com sua versÃ£o usando o Helix Converter.',
        'Download Helix Converter': 'Baixar Helix Converter'
    });
    Object.assign(PAGE_COPY.ru, {
        'Partner / File Converter': 'ĞŸĞ°Ñ€Ñ‚Ğ½Ñ‘Ñ€ / ĞšĞ¾Ğ½Ğ²ĞµÑ€Ñ‚ĞµÑ€ Ñ„Ğ°Ğ¹Ğ»Ğ¾Ğ²',
        'Convert files that do not match your software version and make them compatible with Helix Converter.': 'ĞšĞ¾Ğ½Ğ²ĞµÑ€Ñ‚Ğ¸Ñ€ÑƒĞ¹Ñ‚Ğµ Ñ„Ğ°Ğ¹Ğ»Ñ‹, Ğ½ĞµÑĞ¾Ğ²Ğ¼ĞµÑÑ‚Ğ¸Ğ¼Ñ‹Ğµ Ñ Ğ²Ğ°ÑˆĞµĞ¹ Ğ²ĞµÑ€ÑĞ¸ĞµĞ¹ Ğ¿Ñ€Ğ¾Ğ³Ñ€Ğ°Ğ¼Ğ¼Ñ‹, Ñ Ğ¿Ğ¾Ğ¼Ğ¾Ñ‰ÑŒÑ Helix Converter.',
        'Download Helix Converter': 'Ğ¡ĞºĞ°Ñ‡Ğ°Ñ‚ÑŒ Helix Converter'
    });
    Object.assign(PAGE_COPY.ko, {
        'Partner / File Converter': 'íŒŒíŠ¸ë„ˆ / íŒŒì¼ ë³€í™˜ê¸°',
        'Convert files that do not match your software version and make them compatible with Helix Converter.': 'Helix Converterë¡œ ì‚¬ìš© ì¤‘ì¸ ì†Œí”„íŠ¸ì›¨ì–´ ë²„ì „ê³¼ í˜¸í™˜ë˜ì§€ ì•ŠëŠ” íŒŒì¼ì„ ë³€í™˜í•˜ì„¸ìš”.',
        'Download Helix Converter': 'Helix Converter ë‹¤ìš´ë¡œë“œ'
    });
    Object.assign(PAGE_COPY.zh, {
        'Partner / File Converter': 'åˆä½œä¼™ä¼´ / æ–‡ä»¶è½¬æ¢å™¨',
        'Convert files that do not match your software version and make them compatible with Helix Converter.': 'ä½¿ç”¨ Helix Converter è½¬æ¢ä¸å½“å‰è½¯ä»¶ç‰ˆæœ¬ä¸å…¼å®¹çš„æ–‡ä»¶ã€‚',
        'Download Helix Converter': 'ä¸‹è½½ Helix Converter'
    });
    Object.assign(PAGE_COPY.ar, {
        'Partner / File Converter': 'Ø´Ø±ÙŠÙƒ / Ù…Ø­ÙˆÙ‘Ù„ Ù…Ù„ÙØ§Øª',
        'Convert files that do not match your software version and make them compatible with Helix Converter.': 'Ø­ÙˆÙ‘Ù„ Ø§Ù„Ù…Ù„ÙØ§Øª ØºÙŠØ± Ø§Ù„Ù…ØªÙˆØ§ÙÙ‚Ø© Ù…Ø¹ Ø¥ØµØ¯Ø§Ø± Ø¨Ø±Ù†Ø§Ù…Ø¬Ùƒ Ø¨Ø§Ø³ØªØ®Ø¯Ø§Ù… Helix Converter.',
        'Download Helix Converter': 'ØªÙ†Ø²ÙŠÙ„ Helix Converter'
    });
    var APPLY_COPY = {
        tr: ['AÃ§Ä±k bir rol seÃ§. Sana Discord Ã¼zerinden ulaÅŸacaÄŸÄ±z.', 'DÃ¼zenleme kaynaklarÄ±nÄ± incele ve yayÄ±nla.', 'Sohbetlerin faydalÄ± ve sÄ±cak kalmasÄ±na yardÄ±mcÄ± ol.', 'Åimdi baÅŸvur', 'BaÅŸvuru iÃ§in Discord hesabÄ± gerekir.'],
        es: ['Elige un puesto disponible. Te contactaremos por Discord.', 'Revisa y publica recursos de ediciÃ³n.', 'Ayuda a mantener conversaciones Ãºtiles y acogedoras.', 'Solicitar ahora', 'Necesitas una cuenta de Discord para solicitarlo.'],
        pt: ['Escolha uma vaga aberta. Entraremos em contato pelo Discord.', 'Revise e publique recursos de ediÃ§Ã£o.', 'Ajude a manter as conversas Ãºteis e acolhedoras.', 'Candidatar-se', 'VocÃª precisa de uma conta do Discord para se candidatar.'],
        ru: ['Ğ’Ñ‹Ğ±ĞµÑ€Ğ¸Ñ‚Ğµ Ğ¾Ñ‚ĞºÑ€Ñ‹Ñ‚ÑƒÑ Ñ€Ğ¾Ğ»ÑŒ. ĞœÑ‹ ÑĞ²ÑĞ¶ĞµĞ¼ÑÑ Ñ Ğ²Ğ°Ğ¼Ğ¸ Ğ² Discord.', 'ĞŸÑ€Ğ¾Ğ²ĞµÑ€ÑĞ¹Ñ‚Ğµ Ğ¸ Ğ¿ÑƒĞ±Ğ»Ğ¸ĞºÑƒĞ¹Ñ‚Ğµ Ğ¼Ğ°Ñ‚ĞµÑ€Ğ¸Ğ°Ğ»Ñ‹ Ğ´Ğ»Ñ Ğ¼Ğ¾Ğ½Ñ‚Ğ°Ğ¶Ğ°.', 'ĞŸĞ¾Ğ¼Ğ¾Ğ³Ğ°Ğ¹Ñ‚Ğµ Ğ¿Ğ¾Ğ´Ğ´ĞµÑ€Ğ¶Ğ¸Ğ²Ğ°Ñ‚ÑŒ Ğ¿Ğ¾Ğ»ĞµĞ·Ğ½Ğ¾Ğµ Ğ¸ Ğ´Ñ€ÑƒĞ¶ĞµĞ»ÑĞ±Ğ½Ğ¾Ğµ Ğ¾Ğ±Ñ‰ĞµĞ½Ğ¸Ğµ.', 'ĞŸĞ¾Ğ´Ğ°Ñ‚ÑŒ Ğ·Ğ°ÑĞ²ĞºÑƒ', 'Ğ”Ğ»Ñ Ğ¿Ğ¾Ğ´Ğ°Ñ‡Ğ¸ Ğ·Ğ°ÑĞ²ĞºĞ¸ Ğ½ÑƒĞ¶Ğ½Ğ° ÑƒÑ‡Ñ‘Ñ‚Ğ½Ğ°Ñ Ğ·Ğ°Ğ¿Ğ¸ÑÑŒ Discord.'],
        ko: ['ì—´ë ¤ ìˆëŠ” ì—­í• ì„ ì„ íƒí•˜ì„¸ìš”. Discordë¡œ ì—°ë½ë“œë¦´ê²Œìš”.', 'í¸ì§‘ ìë£Œë¥¼ ê²€í† í•˜ê³  ê²Œì‹œí•˜ì„¸ìš”.', 'ìœ ìµí•˜ê³  ë”°ëœ»í•œ ëŒ€í™”ë¥¼ ë§Œë“¤ì–´ ì£¼ì„¸ìš”.', 'ì§€ê¸ˆ ì§€ì›í•˜ê¸°', 'ì§€ì›í•˜ë ¤ë©´ Discord ê³„ì •ì´ í•„ìš”í•©ë‹ˆë‹¤.'],
        zh: ['é€‰æ‹©ä¸€ä¸ªå¼€æ”¾èŒä½ã€‚æˆ‘ä»¬ä¼šé€šè¿‡ Discord è”ç³»ä½ ã€‚', 'å®¡æ ¸å¹¶å‘å¸ƒå‰ªè¾‘èµ„æºã€‚', 'å¸®åŠ©ç¤¾åŒºä¿æŒå‹å¥½ä¸”æœ‰å¸®åŠ©çš„äº¤æµã€‚', 'ç«‹å³ç”³è¯·', 'ç”³è¯·éœ€è¦ Discord è´¦å·ã€‚'],
        ar: ['Ø§Ø®ØªØ± Ø¯ÙˆØ±Ù‹Ø§ Ù…ØªØ§Ø­Ù‹Ø§. Ø³Ù†ØªÙˆØ§ØµÙ„ Ù…Ø¹Ùƒ Ø¹Ø¨Ø± Discord.', 'Ø±Ø§Ø¬Ø¹ Ù…ÙˆØ§Ø±Ø¯ Ø§Ù„ØªØ­Ø±ÙŠØ± ÙˆØ§Ù†Ø´Ø±Ù‡Ø§.', 'Ø³Ø§Ø¹Ø¯ ÙÙŠ Ø¥Ø¨Ù‚Ø§Ø¡ Ø§Ù„Ù†Ù‚Ø§Ø´Ø§Øª Ù…ÙÙŠØ¯Ø© ÙˆÙ…Ø±Ø­Ù‘Ø¨Ø©.', 'Ù‚Ø¯Ù‘Ù… Ø§Ù„Ø¢Ù†', 'ØªØ­ØªØ§Ø¬ Ø¥Ù„Ù‰ Ø­Ø³Ø§Ø¨ Discord Ù„Ù„ØªÙ‚Ø¯ÙŠÙ….']
    };
    var applyKeys = ['Choose an open role. Weâ€™ll contact you on Discord.', 'Review and publish editing resources.', 'Keep discussions useful and welcoming.', 'Apply now', 'Youâ€™ll need a Discord account.'];
    Object.keys(APPLY_COPY).forEach(function (code) {
        applyKeys.forEach(function (key, index) { PAGE_COPY[code][key] = APPLY_COPY[code][index]; });
    });
    var STAFF_FORM_KEYS = [
        'Find, check and publish editing leaks and stuff.',
        'Keep the feed, comments and Discord calm and on-topic.',
        'Only upload files you have checked yourself.', 'Credit the original creator.',
        'Fill in title, category, tags and thumbnail.', 'No re-uploads of what is already listed.',
        'Send anything suspicious to the founder instead.', 'Same rules for everyone, staff included.',
        'Log every warning, mute and ban with a reason.', 'Never share member data or private DM screenshots.',
        'Explain decisions and pass unclear cases to the founder.', 'Stay neutral in public arguments.',
        'Where do your leaks come from?', 'How do you check a file before it goes live?',
        'Which editing apps do you know well?', 'A member keeps breaking the rules after a warning. What now?',
        'A report points at a friend on the team. What do you do?', 'When are you usually online?'
    ];
    var STAFF_FORM_COPY = {
        tr: ['DÃ¼zenleme sÄ±zÄ±ntÄ±larÄ±nÄ± bulun, kontrol edin ve yayÄ±nlayÄ±n.', 'AkÄ±ÅŸta, yorumlarda ve Discordâ€™da sakin ve konuya baÄŸlÄ± bir ortam saÄŸlayÄ±n.', 'YalnÄ±zca kendinizin kontrol ettiÄŸi dosyalarÄ± yÃ¼kleyin.', 'AsÄ±l iÃ§erik Ã¼reticisine kaynak belirtin.', 'BaÅŸlÄ±k, kategori, etiket ve kÃ¼Ã§Ã¼k resmi doldurun.', 'Listede bulunan iÃ§erikleri yeniden yÃ¼klemeyin.', 'ÅÃ¼pheli iÃ§erikleri kurucuya iletin.', 'Ekip Ã¼yeleri de dahil herkes iÃ§in aynÄ± kurallar geÃ§erlidir.', 'Her uyarÄ±, susturma ve yasaklama iÅŸlemini gerekÃ§esiyle kaydedin.', 'Ãœye verilerini veya Ã¶zel DM ekran gÃ¶rÃ¼ntÃ¼lerini paylaÅŸmayÄ±n.', 'KararlarÄ±nÄ±zÄ± aÃ§Ä±klayÄ±n; emin olmadÄ±ÄŸÄ±nÄ±z durumlarÄ± kurucuya iletin.', 'Herkese aÃ§Ä±k tartÄ±ÅŸmalarda tarafsÄ±z kalÄ±n.', 'SÄ±zÄ±ntÄ± dosyalarÄ±nÄ±zÄ±n kaynaklarÄ± neler?', 'Bir dosyayÄ± yayÄ±nlamadan Ã¶nce nasÄ±l kontrol edersiniz?', 'Hangi dÃ¼zenleme uygulamalarÄ±na hÃ¢kimsiniz?', 'Bir Ã¼ye uyarÄ±lmasÄ±na raÄŸmen kurallarÄ± Ã§iÄŸnemeye devam ederse ne yaparsÄ±nÄ±z?', 'Bir rapor ekipteki arkadaÅŸÄ±nÄ±zÄ± hedef alÄ±yorsa ne yaparsÄ±nÄ±z?', 'Genellikle hangi saatlerde Ã§evrimiÃ§isiniz?'],
        es: ['Busca, revisa y publica recursos de ediciÃ³n filtrados.', 'MantÃ©n el feed, los comentarios y Discord tranquilos y centrados.', 'Sube solo archivos que hayas revisado personalmente.', 'Da crÃ©dito al creador original.', 'Completa el tÃ­tulo, la categorÃ­a, las etiquetas y la miniatura.', 'No vuelvas a subir contenido que ya estÃ© publicado.', 'EnvÃ­a cualquier archivo sospechoso al fundador.', 'Las mismas reglas se aplican a todos, incluido el equipo.', 'Registra cada aviso, silencio y expulsiÃ³n con un motivo.', 'No compartas datos de miembros ni capturas de mensajes privados.', 'Explica tus decisiones y consulta los casos dudosos con el fundador.', 'MantÃ©n la neutralidad en las discusiones pÃºblicas.', 'Â¿De dÃ³nde proceden tus filtraciones?', 'Â¿CÃ³mo revisas un archivo antes de publicarlo?', 'Â¿QuÃ© aplicaciones de ediciÃ³n dominas?', 'Â¿QuÃ© harÃ­as si alguien sigue incumpliendo las reglas tras un aviso?', 'Â¿QuÃ© harÃ­as si un informe seÃ±ala a un amigo del equipo?', 'Â¿CuÃ¡ndo sueles estar en lÃ­nea?'],
        pt: ['Encontre, verifique e publique materiais de ediÃ§Ã£o.', 'Mantenha o feed, os comentÃ¡rios e o Discord tranquilos e focados.', 'Envie apenas arquivos que vocÃª mesmo verificou.', 'DÃª crÃ©dito ao criador original.', 'Preencha tÃ­tulo, categoria, tags e miniatura.', 'NÃ£o envie novamente algo que jÃ¡ esteja listado.', 'Encaminhe qualquer arquivo suspeito ao fundador.', 'As mesmas regras valem para todos, inclusive a equipe.', 'Registre cada aviso, silenciamento e banimento com o motivo.', 'Nunca compartilhe dados de membros ou capturas de DMs privadas.', 'Explique as decisÃµes e encaminhe dÃºvidas ao fundador.', 'Mantenha a neutralidade em discussÃµes pÃºblicas.', 'De onde vÃªm seus vazamentos?', 'Como vocÃª verifica um arquivo antes de publicÃ¡-lo?', 'Quais aplicativos de ediÃ§Ã£o vocÃª conhece bem?', 'O que fazer se alguÃ©m continuar quebrando as regras apÃ³s um aviso?', 'O que vocÃª faria se uma denÃºncia apontasse para um amigo da equipe?', 'Quando vocÃª costuma estar online?'],
        ru: ['ĞĞ°Ñ…Ğ¾Ğ´Ğ¸Ñ‚Ğµ, Ğ¿Ñ€Ğ¾Ğ²ĞµÑ€ÑĞ¹Ñ‚Ğµ Ğ¸ Ğ¿ÑƒĞ±Ğ»Ğ¸ĞºÑƒĞ¹Ñ‚Ğµ Ğ¼Ğ°Ñ‚ĞµÑ€Ğ¸Ğ°Ğ»Ñ‹ Ğ´Ğ»Ñ Ğ¼Ğ¾Ğ½Ñ‚Ğ°Ğ¶Ğ°.', 'ĞŸĞ¾Ğ´Ğ´ĞµÑ€Ğ¶Ğ¸Ğ²Ğ°Ğ¹Ñ‚Ğµ ÑĞ¿Ğ¾ĞºĞ¾Ğ¹Ğ½Ğ¾Ğµ Ğ¾Ğ±Ñ‰ĞµĞ½Ğ¸Ğµ Ğ¿Ğ¾ Ñ‚ĞµĞ¼Ğµ Ğ² Ğ»ĞµĞ½Ñ‚Ğµ, ĞºĞ¾Ğ¼Ğ¼ĞµĞ½Ñ‚Ğ°Ñ€Ğ¸ÑÑ… Ğ¸ Discord.', 'Ğ—Ğ°Ğ³Ñ€ÑƒĞ¶Ğ°Ğ¹Ñ‚Ğµ Ñ‚Ğ¾Ğ»ÑŒĞºĞ¾ Ñ„Ğ°Ğ¹Ğ»Ñ‹, ĞºĞ¾Ñ‚Ğ¾Ñ€Ñ‹Ğµ Ğ¿Ñ€Ğ¾Ğ²ĞµÑ€Ğ¸Ğ»Ğ¸ ÑĞ°Ğ¼Ğ¸.', 'Ğ£ĞºĞ°Ğ·Ñ‹Ğ²Ğ°Ğ¹Ñ‚Ğµ Ğ°Ğ²Ñ‚Ğ¾Ñ€Ğ° Ğ¾Ñ€Ğ¸Ğ³Ğ¸Ğ½Ğ°Ğ»Ğ°.', 'Ğ—Ğ°Ğ¿Ğ¾Ğ»Ğ½ÑĞ¹Ñ‚Ğµ Ğ½Ğ°Ğ·Ğ²Ğ°Ğ½Ğ¸Ğµ, ĞºĞ°Ñ‚ĞµĞ³Ğ¾Ñ€Ğ¸Ñ, Ñ‚ĞµĞ³Ğ¸ Ğ¸ Ğ¼Ğ¸Ğ½Ğ¸Ğ°Ñ‚ÑÑ€Ñƒ.', 'ĞĞµ Ğ·Ğ°Ğ³Ñ€ÑƒĞ¶Ğ°Ğ¹Ñ‚Ğµ Ğ¿Ğ¾Ğ²Ñ‚Ğ¾Ñ€Ğ½Ğ¾ ÑƒĞ¶Ğµ Ğ¾Ğ¿ÑƒĞ±Ğ»Ğ¸ĞºĞ¾Ğ²Ğ°Ğ½Ğ½Ñ‹Ğµ Ğ¼Ğ°Ñ‚ĞµÑ€Ğ¸Ğ°Ğ»Ñ‹.', 'ĞŸĞ¾Ğ´Ğ¾Ğ·Ñ€Ğ¸Ñ‚ĞµĞ»ÑŒĞ½Ñ‹Ğµ Ñ„Ğ°Ğ¹Ğ»Ñ‹ Ğ¾Ñ‚Ğ¿Ñ€Ğ°Ğ²Ğ»ÑĞ¹Ñ‚Ğµ Ğ¾ÑĞ½Ğ¾Ğ²Ğ°Ñ‚ĞµĞ»Ñ.', 'ĞŸÑ€Ğ°Ğ²Ğ¸Ğ»Ğ° Ğ¾Ğ´Ğ¸Ğ½Ğ°ĞºĞ¾Ğ²Ñ‹ Ğ´Ğ»Ñ Ğ²ÑĞµÑ…, Ğ²ĞºĞ»ÑÑ‡Ğ°Ñ ĞºĞ¾Ğ¼Ğ°Ğ½Ğ´Ñƒ.', 'Ğ¤Ğ¸ĞºÑĞ¸Ñ€ÑƒĞ¹Ñ‚Ğµ Ğ¿Ñ€ĞµĞ´ÑƒĞ¿Ñ€ĞµĞ¶Ğ´ĞµĞ½Ğ¸Ñ, Ñ‚Ğ°Ğ¹Ğ¼-Ğ°ÑƒÑ‚Ñ‹ Ğ¸ Ğ±Ğ»Ğ¾ĞºĞ¸Ñ€Ğ¾Ğ²ĞºĞ¸ Ñ Ğ¿Ñ€Ğ¸Ñ‡Ğ¸Ğ½Ğ¾Ğ¹.', 'ĞĞµ Ğ¿ÑƒĞ±Ğ»Ğ¸ĞºÑƒĞ¹Ñ‚Ğµ Ğ´Ğ°Ğ½Ğ½Ñ‹Ğµ ÑƒÑ‡Ğ°ÑÑ‚Ğ½Ğ¸ĞºĞ¾Ğ² Ğ¸ ÑĞºÑ€Ğ¸Ğ½ÑˆĞ¾Ñ‚Ñ‹ Ğ»Ğ¸Ñ‡Ğ½Ñ‹Ñ… ÑĞ¾Ğ¾Ğ±Ñ‰ĞµĞ½Ğ¸Ğ¹.', 'ĞĞ±ÑŠÑÑĞ½ÑĞ¹Ñ‚Ğµ Ñ€ĞµÑˆĞµĞ½Ğ¸Ñ Ğ¸ Ğ¿ĞµÑ€ĞµĞ´Ğ°Ğ²Ğ°Ğ¹Ñ‚Ğµ ÑĞ¿Ğ¾Ñ€Ğ½Ñ‹Ğµ ÑĞ»ÑƒÑ‡Ğ°Ğ¸ Ğ¾ÑĞ½Ğ¾Ğ²Ğ°Ñ‚ĞµĞ»Ñ.', 'Ğ¡Ğ¾Ñ…Ñ€Ğ°Ğ½ÑĞ¹Ñ‚Ğµ Ğ½ĞµĞ¹Ñ‚Ñ€Ğ°Ğ»Ğ¸Ñ‚ĞµÑ‚ Ğ² Ğ¿ÑƒĞ±Ğ»Ğ¸Ñ‡Ğ½Ñ‹Ñ… ÑĞ¿Ğ¾Ñ€Ğ°Ñ….', 'ĞÑ‚ĞºÑƒĞ´Ğ° Ñƒ Ğ²Ğ°Ñ Ğ¼Ğ°Ñ‚ĞµÑ€Ğ¸Ğ°Ğ»Ñ‹?', 'ĞšĞ°Ğº Ğ²Ñ‹ Ğ¿Ñ€Ğ¾Ğ²ĞµÑ€ÑĞµÑ‚Ğµ Ñ„Ğ°Ğ¹Ğ» Ğ¿ĞµÑ€ĞµĞ´ Ğ¿ÑƒĞ±Ğ»Ğ¸ĞºĞ°Ñ†Ğ¸ĞµĞ¹?', 'Ğ’ ĞºĞ°ĞºĞ¸Ñ… Ğ¿Ñ€Ğ¾Ğ³Ñ€Ğ°Ğ¼Ğ¼Ğ°Ñ… Ğ´Ğ»Ñ Ğ¼Ğ¾Ğ½Ñ‚Ğ°Ğ¶Ğ° Ğ²Ñ‹ Ñ…Ğ¾Ñ€Ğ¾ÑˆĞ¾ Ñ€Ğ°Ğ·Ğ±Ğ¸Ñ€Ğ°ĞµÑ‚ĞµÑÑŒ?', 'Ğ§Ñ‚Ğ¾ Ğ²Ñ‹ ÑĞ´ĞµĞ»Ğ°ĞµÑ‚Ğµ, ĞµÑĞ»Ğ¸ ÑƒÑ‡Ğ°ÑÑ‚Ğ½Ğ¸Ğº Ğ¿Ñ€Ğ¾Ğ´Ğ¾Ğ»Ğ¶Ğ¸Ñ‚ Ğ½Ğ°Ñ€ÑƒÑˆĞ°Ñ‚ÑŒ Ğ¿Ñ€Ğ°Ğ²Ğ¸Ğ»Ğ° Ğ¿Ğ¾ÑĞ»Ğµ Ğ¿Ñ€ĞµĞ´ÑƒĞ¿Ñ€ĞµĞ¶Ğ´ĞµĞ½Ğ¸Ñ?', 'Ğ§Ñ‚Ğ¾ Ğ²Ñ‹ ÑĞ´ĞµĞ»Ğ°ĞµÑ‚Ğµ, ĞµÑĞ»Ğ¸ Ğ¶Ğ°Ğ»Ğ¾Ğ±Ğ° ĞºĞ°ÑĞ°ĞµÑ‚ÑÑ Ğ²Ğ°ÑˆĞµĞ³Ğ¾ Ğ´Ñ€ÑƒĞ³Ğ° Ğ¸Ğ· ĞºĞ¾Ğ¼Ğ°Ğ½Ğ´Ñ‹?', 'ĞšĞ¾Ğ³Ğ´Ğ° Ğ²Ñ‹ Ğ¾Ğ±Ñ‹Ñ‡Ğ½Ğ¾ Ğ±Ñ‹Ğ²Ğ°ĞµÑ‚Ğµ Ğ² ÑĞµÑ‚Ğ¸?'],
        ko: ['í¸ì§‘ ìë£Œë¥¼ ì°¾ê³  í™•ì¸í•œ ë’¤ ê²Œì‹œí•˜ì„¸ìš”.', 'í”¼ë“œ, ëŒ“ê¸€, Discordì—ì„œ ì°¨ë¶„í•˜ê³  ì£¼ì œì— ë§ëŠ” ë¶„ìœ„ê¸°ë¥¼ ìœ ì§€í•˜ì„¸ìš”.', 'ì§ì ‘ í™•ì¸í•œ íŒŒì¼ë§Œ ì—…ë¡œë“œí•˜ì„¸ìš”.', 'ì›ì‘ìë¥¼ í‘œì‹œí•˜ì„¸ìš”.', 'ì œëª©, ì¹´í…Œê³ ë¦¬, íƒœê·¸, ì¸ë„¤ì¼ì„ ì…ë ¥í•˜ì„¸ìš”.', 'ì´ë¯¸ ë“±ë¡ëœ íŒŒì¼ì„ ë‹¤ì‹œ ì—…ë¡œë“œí•˜ì§€ ë§ˆì„¸ìš”.', 'ì˜ì‹¬ìŠ¤ëŸ¬ìš´ íŒŒì¼ì€ ìš´ì˜ìì—ê²Œ ì „ë‹¬í•˜ì„¸ìš”.', 'ìš´ì˜ì§„ì„ í¬í•¨í•´ ëª¨ë‘ì—ê²Œ ê°™ì€ ê·œì¹™ì„ ì ìš©í•˜ì„¸ìš”.', 'ê²½ê³ , íƒ€ì„ì•„ì›ƒ, ì°¨ë‹¨ì„ ì‚¬ìœ ì™€ í•¨ê»˜ ê¸°ë¡í•˜ì„¸ìš”.', 'íšŒì› ì •ë³´ë‚˜ ë¹„ê³µê°œ DM ìŠ¤í¬ë¦°ìƒ·ì„ ê³µìœ í•˜ì§€ ë§ˆì„¸ìš”.', 'ê²°ì • ì´ìœ ë¥¼ ì„¤ëª…í•˜ê³  ì• ë§¤í•œ ì‚¬ë¡€ëŠ” ìš´ì˜ìì—ê²Œ ì „ë‹¬í•˜ì„¸ìš”.', 'ê³µê°œ ë…¼ìŸì—ì„œ ì¤‘ë¦½ì„ ì§€í‚¤ì„¸ìš”.', 'ìë£ŒëŠ” ì–´ë””ì—ì„œ êµ¬í•˜ë‚˜ìš”?', 'ê²Œì‹œ ì „ì— íŒŒì¼ì„ ì–´ë–»ê²Œ í™•ì¸í•˜ë‚˜ìš”?', 'ì–´ë–¤ í¸ì§‘ ì•±ì„ ì˜ ë‹¤ë£¨ë‚˜ìš”?', 'ê²½ê³  í›„ì—ë„ ê·œì¹™ì„ ì–´ê¸°ëŠ” íšŒì›ì—ê²Œ ì–´ë–»ê²Œ ëŒ€ì‘í•˜ë‚˜ìš”?', 'íŒ€ ì¹œêµ¬ê°€ ì‹ ê³  ëŒ€ìƒì´ë¼ë©´ ì–´ë–»ê²Œ ì²˜ë¦¬í•˜ë‚˜ìš”?', 'ì£¼ë¡œ ì–¸ì œ ì˜¨ë¼ì¸ì¸ê°€ìš”?'],
        zh: ['æŸ¥æ‰¾ã€æ£€æŸ¥å¹¶å‘å¸ƒå‰ªè¾‘èµ„æºã€‚', 'è®©åŠ¨æ€ã€è¯„è®ºå’Œ Discord ä¿æŒå¹³å’Œå¹¶å›´ç»•ä¸»é¢˜ã€‚', 'åªä¸Šä¼ è‡ªå·±æ£€æŸ¥è¿‡çš„æ–‡ä»¶ã€‚', 'æ³¨æ˜åŸä½œè€…ã€‚', 'å¡«å†™æ ‡é¢˜ã€åˆ†ç±»ã€æ ‡ç­¾å’Œç¼©ç•¥å›¾ã€‚', 'ä¸è¦é‡å¤ä¸Šä¼ å·²ç»æ”¶å½•çš„å†…å®¹ã€‚', 'å‘ç°å¯ç–‘æ–‡ä»¶æ—¶è¯·äº¤ç»™åˆ›å§‹äººå¤„ç†ã€‚', 'æ‰€æœ‰äººéƒ½éµå®ˆç›¸åŒè§„åˆ™ï¼ŒåŒ…æ‹¬å›¢é˜Ÿæˆå‘˜ã€‚', 'è®°å½•æ¯æ¬¡è­¦å‘Šã€ç¦è¨€å’Œå°ç¦åŠå…¶åŸå› ã€‚', 'ä¸è¦åˆ†äº«æˆå‘˜æ•°æ®æˆ–ç§äºº DM æˆªå›¾ã€‚', 'è§£é‡Šå¤„ç†å†³å®šï¼Œå¹¶å°†ä¸ç¡®å®šçš„æƒ…å†µäº¤ç»™åˆ›å§‹äººã€‚', 'åœ¨å…¬å¼€äº‰è®ºä¸­ä¿æŒä¸­ç«‹ã€‚', 'ä½ çš„èµ„æºæ¥è‡ªå“ªé‡Œï¼Ÿ', 'å‘å¸ƒå‰å¦‚ä½•æ£€æŸ¥æ–‡ä»¶ï¼Ÿ', 'ä½ ç†Ÿæ‚‰å“ªäº›å‰ªè¾‘è½¯ä»¶ï¼Ÿ', 'æˆå‘˜è­¦å‘Šåä»æŒç»­è¿è§„ï¼Œä½ ä¼šæ€ä¹ˆå¤„ç†ï¼Ÿ', 'å¦‚æœä¸¾æŠ¥å¯¹è±¡æ˜¯å›¢é˜Ÿä¸­çš„æœ‹å‹ï¼Œä½ ä¼šæ€ä¹ˆåšï¼Ÿ', 'ä½ é€šå¸¸ä»€ä¹ˆæ—¶å€™åœ¨çº¿ï¼Ÿ'],
        ar: ['Ø§Ø¹Ø«Ø± Ø¹Ù„Ù‰ Ù…ÙˆØ§Ø±Ø¯ Ø§Ù„Ù…ÙˆÙ†ØªØ§Ø¬ ÙˆØ§ÙØ­ØµÙ‡Ø§ ÙˆØ§Ù†Ø´Ø±Ù‡Ø§.', 'Ø­Ø§ÙØ¸ Ø¹Ù„Ù‰ Ù‡Ø¯ÙˆØ¡ Ø§Ù„Ù†Ù‚Ø§Ø´ ÙˆØªØ±ÙƒÙŠØ²Ù‡ ÙÙŠ Ø§Ù„Ø®Ù„Ø§ØµØ© ÙˆØ§Ù„ØªØ¹Ù„ÙŠÙ‚Ø§Øª ÙˆDiscord.', 'Ø§Ø±ÙØ¹ Ø§Ù„Ù…Ù„ÙØ§Øª Ø§Ù„ØªÙŠ ØªØ­Ù‚Ù‚Øª Ù…Ù†Ù‡Ø§ Ø¨Ù†ÙØ³Ùƒ ÙÙ‚Ø·.', 'Ø§Ø°ÙƒØ± ØµØ§Ø­Ø¨ Ø§Ù„Ù…Ø­ØªÙˆÙ‰ Ø§Ù„Ø£ØµÙ„ÙŠ.', 'Ø£ÙƒÙ…Ù„ Ø§Ù„Ø¹Ù†ÙˆØ§Ù† ÙˆØ§Ù„ÙØ¦Ø© ÙˆØ§Ù„ÙˆØ³ÙˆÙ… ÙˆØ§Ù„ØµÙˆØ±Ø© Ø§Ù„Ù…ØµØºÙ‘Ø±Ø©.', 'Ù„Ø§ ØªÙØ¹Ø¯ Ø±ÙØ¹ Ø§Ù„Ù…Ø­ØªÙˆÙ‰ Ø§Ù„Ù…ÙˆØ¬ÙˆØ¯ Ø¨Ø§Ù„ÙØ¹Ù„.', 'Ø£Ø±Ø³Ù„ Ø§Ù„Ù…Ù„ÙØ§Øª Ø§Ù„Ù…Ø´Ø¨ÙˆÙ‡Ø© Ø¥Ù„Ù‰ Ø§Ù„Ù…Ø¤Ø³Ø³.', 'Ø§Ù„Ù‚ÙˆØ§Ø¹Ø¯ ÙˆØ§Ø­Ø¯Ø© Ù„Ù„Ø¬Ù…ÙŠØ¹ØŒ Ø¨Ù…Ø§ ÙÙŠ Ø°Ù„Ùƒ ÙØ±ÙŠÙ‚ Ø§Ù„Ø¹Ù…Ù„.', 'Ø³Ø¬Ù‘Ù„ ÙƒÙ„ ØªØ­Ø°ÙŠØ± ÙˆÙƒØªÙ… ÙˆØ­Ø¸Ø± Ù…Ø¹ Ø°ÙƒØ± Ø§Ù„Ø³Ø¨Ø¨.', 'Ù„Ø§ ØªØ´Ø§Ø±Ùƒ Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ø£Ø¹Ø¶Ø§Ø¡ Ø£Ùˆ Ù„Ù‚Ø·Ø§Øª Ø§Ù„Ø±Ø³Ø§Ø¦Ù„ Ø§Ù„Ø®Ø§ØµØ©.', 'Ø§Ø´Ø±Ø­ Ù‚Ø±Ø§Ø±Ø§ØªÙƒ ÙˆØ£Ø­Ù„ Ø§Ù„Ø­Ø§Ù„Ø§Øª ØºÙŠØ± Ø§Ù„ÙˆØ§Ø¶Ø­Ø© Ø¥Ù„Ù‰ Ø§Ù„Ù…Ø¤Ø³Ø³.', 'Ø§Ù„ØªØ²Ù… Ø§Ù„Ø­ÙŠØ§Ø¯ ÙÙŠ Ø§Ù„Ù†Ù‚Ø§Ø´Ø§Øª Ø§Ù„Ø¹Ø§Ù…Ø©.', 'Ù…Ø§ Ù…ØµØ§Ø¯Ø± Ø§Ù„Ù…Ù„ÙØ§Øª Ø§Ù„ØªÙŠ ØªØ±ÙØ¹Ù‡Ø§ØŸ', 'ÙƒÙŠÙ ØªØªØ­Ù‚Ù‚ Ù…Ù† Ø§Ù„Ù…Ù„Ù Ù‚Ø¨Ù„ Ù†Ø´Ø±Ù‡ØŸ', 'Ù…Ø§ ØªØ·Ø¨ÙŠÙ‚Ø§Øª Ø§Ù„Ù…ÙˆÙ†ØªØ§Ø¬ Ø§Ù„ØªÙŠ ØªØªÙ‚Ù†Ù‡Ø§ØŸ', 'Ù…Ø§Ø°Ø§ ØªÙØ¹Ù„ Ø¥Ø°Ø§ ÙˆØ§ØµÙ„ Ø¹Ø¶Ùˆ Ù…Ø®Ø§Ù„ÙØ© Ø§Ù„Ù‚ÙˆØ§Ø¹Ø¯ Ø¨Ø¹Ø¯ Ø§Ù„ØªØ­Ø°ÙŠØ±ØŸ', 'Ù…Ø§Ø°Ø§ ØªÙØ¹Ù„ Ø¥Ø°Ø§ Ø£Ø´Ø§Ø± Ø¨Ù„Ø§Øº Ø¥Ù„Ù‰ ØµØ¯ÙŠÙ‚ ÙÙŠ Ø§Ù„ÙØ±ÙŠÙ‚ØŸ', 'Ù…ØªÙ‰ ØªÙƒÙˆÙ† Ù…ØªØµÙ„Ø§Ù‹ Ø¹Ø§Ø¯Ø©Ù‹ØŸ']
    };
    Object.keys(STAFF_FORM_COPY).forEach(function (code) {
        STAFF_FORM_KEYS.forEach(function (key, index) { PAGE_COPY[code][key] = STAFF_FORM_COPY[code][index]; });
    });

    var currentLanguage = 'en';
    var dictionary = null;
    var packPromises = {};
    var packCache = {};
    var textSource = new WeakMap();
    var textRendered = new WeakMap();
    var attrSource = new WeakMap();
    var attrRendered = new WeakMap();
    var explicitSource = new WeakMap();
    var metaSource = new WeakMap();
    var titleSource = null;
    var titleRendered = null;
    var observer = null;
    var launcher = null;
    var launcherButton = null;
    var launcherPanel = null;
    var launcherCode = null;
    var launcherList = null;
    var listeners = [];
    var started = false;
    var localChoice = false;

    function normalize(value) {
        return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
    }

    function isSupported(code) {
        return Object.prototype.hasOwnProperty.call(LANG_BY_CODE, String(code || '').toLowerCase());
    }

    function readStoredLanguage() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                var code = String(raw).toLowerCase().split('-')[0];
                if (isSupported(code)) {
                    localChoice = true;
                    return code;
                }
            }
        } catch (e) {}
        return 'en';
    }

    function readDownloadLanguage() {
        var path = String(window.location.pathname || '').toLowerCase();
        if (path !== '/download' && path !== '/download.html' && !window.location.hostname.toLowerCase().startsWith('dl.')) return '';
        try {
            var code = String(new URLSearchParams(window.location.search).get('lang') || '').toLowerCase().split('-')[0];
            return isSupported(code) ? code : '';
        } catch (e) { return ''; }
    }

    function storeLanguage(code) {
        localChoice = true;
        try { localStorage.setItem(STORAGE_KEY, code); } catch (e) {}
    }

    function hasAuthUser() {
        if (window._currentUser || window.currentUser) return true;
        try {
            var raw = localStorage.getItem(AUTH_CACHE_KEY);
            if (!raw) return false;
            var cached = JSON.parse(raw);
            return Boolean(cached && cached.data);
        } catch (e) {
            return false;
        }
    }

    function loadPack(code) {
        if (code === 'en') return Promise.resolve({});
        if (packCache[code]) return Promise.resolve(packCache[code]);
        if (packPromises[code]) return packPromises[code];

        packPromises[code] = new Promise(function (resolve) {
            function finishPack(pack) {
                var isLegalPage = /^\/(?:terms|privacy|dmca)(?:\.html)?\/?$/i.test(window.location.pathname);
                if (!isLegalPage) {
                    packCache[code] = pack;
                    resolve(pack);
                    return;
                }
                fetch(PACK_PATH + 'legal/' + code + '.json?v=' + PACK_VERSION, { credentials: 'same-origin' })
                    .then(function (response) { return response.ok ? response.json() : {}; })
                    .catch(function () { return {}; })
                    .then(function (legalCopy) {
                        packCache[code] = Object.assign({}, legalCopy || {}, pack);
                        resolve(packCache[code]);
                    });
            }
            var script = document.createElement('script');
            script.src = PACK_PATH + code + '.js?v=' + PACK_VERSION;
            script.async = true;
            script.onload = function () {
                var packs = window.ZyrexI18nDictionaries || {};
                finishPack(packs[code] && typeof packs[code] === 'object' ? packs[code] : {});
            };
            script.onerror = function () {
                finishPack({});
            };
            (document.head || document.documentElement).appendChild(script);
        });
        return packPromises[code];
    }

    function lookup(text) {
        if (!dictionary || !text) return null;
        var hit = dictionary[text];
        if (typeof hit !== 'string' || !hit) hit = PAGE_COPY[currentLanguage] && PAGE_COPY[currentLanguage][text];
        return typeof hit === 'string' && hit ? hit : null;
    }

    /* Timestamps and repost lines are assembled in English by the page scripts
       ("2 days ago", "reyli reposted"). Their numbers differ per row, so they are
       rebuilt from the pack templates instead of matched verbatim. */
    var DYNAMIC_PATTERNS = [
        { re: /^(.*?)today$/i, key: 'today', prefix: true },
        { re: /^(.*?)yesterday$/i, key: 'yesterday', prefix: true },
        { re: /^(\d+)\s+days?$/i, key: function (match) {
            return Number(match[1]) === 1 ? '{n} day' : '{n} days';
        }, value: 1 },
        { re: /^(.*?)(\d+)\s+days?\s+ago$/i, key: '{n} days ago', value: 2, prefix: true },
        { re: /^(.*?)(\d+)\s+months?\s+ago$/i, key: '{n} months ago', value: 2, prefix: true },
        { re: /^(.*?)(\d+)\s+years?\s+ago$/i, key: function (match) {
            return Number(match[2]) === 1 ? '{n} year ago' : '{n} years ago';
        }, value: 2, prefix: true },
        { re: /^(.*?)(\d+)\s*m(?:\s+ago)?$/i, key: function (match) {
            return /\s+ago$/i.test(match[0]) ? '{n}m ago' : '{n}m';
        }, value: 2, prefix: true },
        { re: /^(.*?)(\d+)\s*h(?:\s+ago)?$/i, key: function (match) {
            return /\s+ago$/i.test(match[0]) ? '{n}h ago' : '{n}h';
        }, value: 2, prefix: true },
        { re: /^(.*?)(\d+)\s*d(?:\s+ago)?$/i, key: function (match) {
            return /\s+ago$/i.test(match[0]) ? '{n}d ago' : '{n}d';
        }, value: 2, prefix: true },
        { re: /^(.*?)(\d+)\s*s(?:\s+ago)?$/i, key: function (match) {
            return /\s+ago$/i.test(match[0]) ? '{n}s ago' : '{n}s';
        }, value: 2, prefix: true },
        { re: /^(.*?)(\d+)\s+available$/i, key: '{n} available', value: 2, prefix: true },
        { re: /^(.*?)(\d+)\s+items?$/i, key: function (match) {
            return Number(match[2]) === 1 ? '{n} item' : '{n} items';
        }, value: 2, prefix: true },
        { re: /^(.*?)(\d+)\s+flagged$/i, key: '{n} flagged', value: 2, prefix: true },
        { re: /^(.*?)VT\s+(\d+)\s+clean$/i, key: 'VT {n} clean', value: 2, prefix: true },
        { re: /^(.*?)(\d+)\s+days?\s+left$/i, key: function (match) {
            return Number(match[2]) === 1 ? '{n} day left' : '{n} days left';
        }, value: 2, prefix: true },
        { re: /^(.*?)Please wait\s+(\d+)\s+seconds before generating another download link for this preset\.?$/i, key: 'Please wait {n} seconds before generating another download link for this preset.', value: 2, prefix: true },
        { re: /^(.*?)Wait\s+\((\d+)s\)$/i, key: 'Wait ({n}s)', value: 2, prefix: true },
        { re: /^(.*?)Available Download Mirrors\s+\((\d+)\)$/i, key: 'Available Download Mirrors ({n})', value: 2, prefix: true },
        { re: /^Files in this pack \((\d+)\)$/i, key: 'Files in this pack ({n})', value: 1 },
        { re: /^Files selected \((\d+)\/(\d+)\)$/i, key: 'Files selected ({n}/{name})', value: 1, name: 2 },
        { re: /^Download Selected \((\d+)\) with ZIP$/i, key: 'Download Selected ({n}) with ZIP', value: 1 },
        { re: /^Page\s+(\d+)\s+of\s+(\d+)$/i, key: 'Page {n} of {name}', value: 1, name: 2 },
        { re: /^(.*?)VirusTotal:\s+(\d+)\s+Vendors Clean$/i, key: '{n} Vendors Clean', value: 2, prefix: true },
        { re: /^(.*?)VirusTotal:\s+(\d+)\s+Flagged\s+\/\s+(\d+)\s+Clean$/i, key: '{n} Flagged / {name} Clean', value: 2, name: 3, prefix: true },
        { re: /^Download via\s+(.+)$/i, key: 'Download via {name}', name: 1 },
        { re: /^Download\s+(.+)$/i, key: 'Download {name}', name: 1 },
        { re: /^More from\s+(.+)$/i, key: 'More from {name}', name: 1 },
        { re: /^(.+?)\s+reposted$/i, key: '{name} reposted' }
    ];

    function lookupDynamic(text) {
        if (!dictionary || !text) return null;
        for (var i = 0; i < DYNAMIC_PATTERNS.length; i++) {
            var pattern = DYNAMIC_PATTERNS[i];
            var match = text.match(pattern.re);
            if (!match) continue;
            var key = typeof pattern.key === 'function' ? pattern.key(match) : pattern.key;
            var template = lookup(key);
            if (template == null) return null;
            var value = pattern.value ? match[pattern.value] : match[1];
            var name = pattern.name ? match[pattern.name] : value;
            var translated = template.replace(/\{n\}/g, value).replace(/\{name\}/g, name);
            return (pattern.prefix ? match[1] : '') + translated;
        }
        return null;
    }

    function uiText(english) {
        return lookup(english) || UI_EN[english] || english;
    }

    function shouldSkipElement(el, selector) {
        if (!el || typeof el.closest !== 'function') return true;
        if (el.closest(selector)) return true;
        var editable = el.closest('[contenteditable]');
        if (editable && editable.getAttribute('contenteditable') === 'false') editable = null;
        return Boolean(editable);
    }

    function skipNode(node) {
        var el = node && node.nodeType === 1 ? node : (node && node.parentElement);
        return shouldSkipElement(el, SKIP_SELECTOR);
    }

    function skipAttributeElement(el) {
        return shouldSkipElement(el, SKIP_ATTRIBUTE_SELECTOR);
    }

    function splitEdges(value) {
        var match = String(value).match(/^(\s*)([\s\S]*?)(\s*)$/);
        return { lead: match[1], core: match[2], trail: match[3] };
    }

    function renderTextNode(node) {
        if (!node.isConnected || skipNode(node)) return;

        var source = textSource.has(node) ? textSource.get(node) : node.nodeValue;
        if (source == null || !/[^\s]/.test(source)) return;

        var edges = splitEdges(source);
        var key = normalize(edges.core);
        if (!key) return;
        var translated = lookup(key);
        if (translated == null) translated = lookupDynamic(key);

        if (translated == null) {
            if (textSource.has(node) && node.nodeValue !== source) {
                textRendered.set(node, source);
                node.nodeValue = source;
            }
            return;
        }

        if (!textSource.has(node)) textSource.set(node, source);
        var next = edges.lead + translated + edges.trail;
        textRendered.set(node, next);
        if (node.nodeValue !== next) node.nodeValue = next;
    }

    function renderAttribute(el, name) {
        if (!el || el.nodeType !== 1 || skipAttributeElement(el)) return;
        if (name === 'value' && !(el.tagName === 'INPUT' && /^(submit|button|reset)$/i.test(el.type || ''))) return;

        var current = el.getAttribute(name);
        if (current == null) return;

        var sources = attrSource.get(el);
        if (!sources) {
            sources = {};
            attrSource.set(el, sources);
        }
        var rendered = attrRendered.get(el) || {};
        var source = Object.prototype.hasOwnProperty.call(sources, name) ? sources[name] : current;
        if (source == null) return;

        var edges = splitEdges(source);
        var key = normalize(edges.core);
        if (!key) return;
        var translated = lookup(key);
        if (translated == null) translated = lookupDynamic(key);

        if (translated == null) {
            if (Object.prototype.hasOwnProperty.call(sources, name) && current !== source) {
                rendered[name] = source;
                attrRendered.set(el, rendered);
                el.setAttribute(name, source);
            }
            return;
        }

        if (!Object.prototype.hasOwnProperty.call(sources, name)) sources[name] = source;
        var next = edges.lead + translated + edges.trail;
        rendered[name] = next;
        attrRendered.set(el, rendered);
        if (current !== next) el.setAttribute(name, next);
    }

    function renderExplicitText(el) {
        var key = el.getAttribute('data-i18n');
        if (!key) return false;
        if (el.hasAttribute('data-i18n-skip')) return true;

        if (!explicitSource.has(el)) explicitSource.set(el, el.textContent);
        var source = explicitSource.get(el);
        var translated = lookup(normalize(key));
        /* Some older pages use semantic data-i18n keys while language packs are
           keyed by their English source copy. Fall back to that copy so those
           elements participate in the same multilingual system. */
        if (translated == null) translated = lookup(normalize(source));
        if (translated == null) {
            // Explicitly translated nodes replace their textContent as a unit.
            // When switching back to English (or to a pack without that key),
            // restore the original source instead of leaving the prior language visible.
            if (el.textContent !== source) el.textContent = source;
            return true;
        }
        var next = translated == null ? source : translated;
        if (el.textContent !== next) el.textContent = next;
        return true;
    }

    function renderElement(el) {
        if (!el || el.nodeType !== 1 || skipAttributeElement(el)) return;
        for (var i = 0; i < ATTRS.length; i++) {
            if (el.hasAttribute(ATTRS[i])) renderAttribute(el, ATTRS[i]);
        }
        if (el.tagName === 'INPUT' && /^(submit|button|reset)$/i.test(el.type || '')) renderAttribute(el, 'value');
        if (skipNode(el)) return;
        renderExplicitText(el);
    }

    function renderTree(root) {
        if (!root) return;
        if (root.nodeType === 3) {
            renderTextNode(root);
            return;
        }
        if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;

        if (root.nodeType === 1) renderElement(root);

        var walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, null, false);
        var node = walker.nextNode();
        while (node) {
            if (node.nodeType === 3) renderTextNode(node);
            else renderElement(node);
            node = walker.nextNode();
        }
    }

    function renderDocumentTitle() {
        if (!document.title) return;
        var current = document.title;
        if (titleSource == null || current !== titleRendered) titleSource = current;
        var translated = lookup(normalize(titleSource));
        titleRendered = translated || titleSource;
        if (document.title !== titleRendered) document.title = titleRendered;
    }

    /* Social previews and search results read <meta>, which is outside the body
       walk, so it needs its own pass. */
    var META_SELECTOR = 'meta[name="description"], meta[property="og:description"], meta[name="twitter:description"], meta[property="og:title"], meta[name="twitter:title"], meta[property="og:site_name"]';

    function renderMetaTags() {
        var metas = document.querySelectorAll(META_SELECTOR);
        for (var i = 0; i < metas.length; i++) {
            var meta = metas[i];
            var current = meta.getAttribute('content');
            if (current == null) continue;
            if (!metaSource.has(meta)) metaSource.set(meta, current);
            var source = metaSource.get(meta);
            var translated = lookup(normalize(source));
            var next = translated || source;
            if (current !== next) meta.setAttribute('content', next);
        }
    }

    function renderAll() {
        renderTree(document.body || document.documentElement);
        renderDocumentTitle();
        renderMetaTags();
    }

    function watchDom() {
        if (observer || typeof MutationObserver !== 'function') return;
        observer = new MutationObserver(function (mutations) {
            for (var i = 0; i < mutations.length; i++) {
                var mutation = mutations[i];
                if (mutation.type === 'characterData') {
                    var node = mutation.target;
                    if (node.nodeValue === textRendered.get(node)) continue;
                    textSource.delete(node);
                    renderTextNode(node);
                } else if (mutation.type === 'childList') {
                    for (var j = 0; j < mutation.addedNodes.length; j++) {
                        var added = mutation.addedNodes[j];
                        if (added.nodeType === 3) renderTextNode(added);
                        else if (added.nodeType === 1) renderTree(added);
                    }
                } else if (mutation.type === 'attributes') {
                    var el = mutation.target;
                    if (skipAttributeElement(el)) continue;
                    var name = mutation.attributeName;
                    var rendered = attrRendered.get(el);
                    if (rendered && rendered[name] === el.getAttribute(name)) continue;
                    var sources = attrSource.get(el);
                    if (sources) delete sources[name];
                    if (name === 'value') renderAttribute(el, name);
                    else if (ATTRS.indexOf(name) !== -1) renderAttribute(el, name);
                }
            }
        });
        observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true,
            attributeFilter: ATTRS.concat(['value'])
        });
    }

    function refreshLauncherText() {
        if (!launcher) return;
        var lang = LANG_BY_CODE[currentLanguage] || LANG_BY_CODE.en;
        if (launcherCode) launcherCode.textContent = lang.code.toUpperCase();
        if (launcherButton) {
            launcherButton.setAttribute('aria-label', uiText('Change language'));
            launcherButton.setAttribute('title', uiText('Language') + ' Â· ' + lang.native);
        }
        if (launcherPanel) {
            launcherPanel.setAttribute('aria-label', uiText('Change language'));
            var title = launcherPanel.querySelector('[data-zr-lang-title]');
            if (title) title.textContent = uiText('Language');
            var hint = launcherPanel.querySelector('[data-zr-lang-hint]');
            if (hint) hint.textContent = uiText('Choose the language used across Zyrex.');
            var note = launcherPanel.querySelector('[data-zr-lang-note]');
            if (note) note.textContent = uiText('Saved in this browser and on your Discord account.');
            var close = launcherPanel.querySelector('[data-zr-lang-close]');
            if (close) close.setAttribute('aria-label', uiText('Close'));
        }
        if (launcherList) {
            launcherList.setAttribute('aria-label', uiText('Language'));
            var options = launcherList.querySelectorAll('[data-zr-lang-option]');
            for (var i = 0; i < options.length; i++) {
                var option = options[i];
                var isActive = option.getAttribute('data-zr-lang-option') === currentLanguage;
                option.setAttribute('aria-selected', isActive ? 'true' : 'false');
                option.classList.toggle('is-active', isActive);
            }
        }
        launcher.setAttribute('aria-busy', 'false');
    }

    function closePanel() {
        if (!launcherPanel) return;
        launcherPanel.hidden = true;
        launcher.classList.remove('is-open');
        if (launcherButton) launcherButton.setAttribute('aria-expanded', 'false');
    }

    function openPanel() {
        if (!launcherPanel) return;
        launcherPanel.hidden = false;
        launcher.classList.add('is-open');
        if (launcherButton) launcherButton.setAttribute('aria-expanded', 'true');
        sizePanel();
        var active = launcherList && launcherList.querySelector('[data-zr-lang-option][aria-selected="true"]');
        if (active && typeof active.focus === 'function') active.focus({ preventScroll: true });
    }

    function sizePanel() {
        if (!launcherPanel || !launcherButton || launcherPanel.hidden) return;
        var top = launcherButton.getBoundingClientRect().top;
        var available = Math.max(200, Math.round(top - 24));
        launcherPanel.style.maxHeight = available + 'px';
    }

    function buildLauncher() {
        var pagePath = String(window.location.pathname || '').toLowerCase();
        if (pagePath === '/download' || pagePath === '/download.html' || window.location.hostname.toLowerCase().startsWith('dl.')) return;
        if (launcher || !document.body) return;

        launcher = document.createElement('div');
        launcher.className = 'zr-lang';
        launcher.innerHTML =
            '<div class="zr-lang-panel" role="dialog" aria-modal="false" hidden>' +
                '<div class="zr-lang-head">' +
                    '<div>' +
                        '<strong data-zr-lang-title>Language</strong>' +
                        '<span data-zr-lang-hint>Choose the language used across Zyrex.</span>' +
                    '</div>' +
                    '<button type="button" class="zr-lang-close" data-zr-lang-close aria-label="Close"><i class="fas fa-xmark" aria-hidden="true"></i></button>' +
                '</div>' +
                '<div class="zr-lang-list" role="listbox" aria-label="Language"></div>' +
                '<p class="zr-lang-note" data-zr-lang-note>Saved in this browser and on your Discord account.</p>' +
            '</div>' +
            '<button type="button" class="zr-lang-btn" aria-haspopup="dialog" aria-expanded="false" aria-label="Change language">' +
                '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
                    '<circle cx="12" cy="12" r="9"></circle>' +
                    '<ellipse cx="12" cy="12" rx="4" ry="9"></ellipse>' +
                    '<path d="M3.2 9h17.6M3.2 15h17.6"></path>' +
                '</svg>' +
                '<span class="zr-lang-code">EN</span>' +
            '</button>';

        document.body.appendChild(launcher);
        launcherButton = launcher.querySelector('.zr-lang-btn');
        launcherPanel = launcher.querySelector('.zr-lang-panel');
        launcherCode = launcher.querySelector('.zr-lang-code');
        launcherList = launcher.querySelector('.zr-lang-list');

        launcherList.innerHTML = LANGUAGES.map(function (lang) {
            var secondary = lang.native !== lang.english
                ? '<em>' + lang.english + '</em>'
                : '';
            return '<button type="button" class="zr-lang-option" role="option" data-zr-lang-option="' + lang.code + '" aria-selected="false" lang="' + lang.code + '">' +
                '<span class="zr-lang-badge">' + lang.code.toUpperCase() + '</span>' +
                '<span class="zr-lang-names"><strong>' + lang.native + '</strong>' + secondary + '</span>' +
                '<span class="zr-lang-tick"><i class="fas fa-check" aria-hidden="true"></i></span>' +
                '</button>';
        }).join('');

        launcherButton.addEventListener('click', function () {
            if (launcherPanel.hidden) openPanel();
            else closePanel();
        });
        launcher.querySelector('[data-zr-lang-close]').addEventListener('click', function () {
            closePanel();
            if (launcherButton) launcherButton.focus({ preventScroll: true });
        });
        launcherList.addEventListener('click', function (event) {
            var option = event.target.closest('[data-zr-lang-option]');
            if (!option) return;
            setLanguage(option.getAttribute('data-zr-lang-option'), { syncAccount: true });
            closePanel();
        });
        document.addEventListener('click', function (event) {
            if (!launcher.classList.contains('is-open')) return;
            if (launcher.contains(event.target)) return;
            closePanel();
        });
        document.addEventListener('keydown', function (event) {
            if (event.key !== 'Escape' || !launcher.classList.contains('is-open')) return;
            closePanel();
            if (launcherButton) launcherButton.focus({ preventScroll: true });
        });
        window.addEventListener('resize', sizePanel);

        refreshLauncherText();
    }

    function setDocumentLanguage(code) {
        var lang = LANG_BY_CODE[code] || LANG_BY_CODE.en;
        var root = document.documentElement;
        root.setAttribute('lang', lang.code);
        root.setAttribute('dir', lang.dir);
    }

    function setLanguage(code, options) {
        var opts = options || {};
        var target = isSupported(code) ? String(code).toLowerCase() : 'en';

        return loadPack(target).then(function (pack) {
            dictionary = pack || {};
            currentLanguage = target;
            setDocumentLanguage(target);
            renderAll();
            refreshLauncherText();

            if (opts.persist !== false) storeLanguage(target);
            if (opts.syncAccount) saveToAccount(target);

            for (var i = 0; i < listeners.length; i++) {
                try { listeners[i](target, LANG_BY_CODE[target]); } catch (e) {}
            }
            if (!opts.silent) {
                document.dispatchEvent(new CustomEvent('zyrex:languagechange', {
                    detail: { language: target, direction: LANG_BY_CODE[target].dir }
                }));
            }
            return target;
        });
    }

    function saveToAccount(code) {
        if (!hasAuthUser()) return;
        try {
            fetch(ACCOUNT_ENDPOINT, {
                method: 'POST',
                credentials: 'include',
                cache: 'no-store',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ language: code })
            }).catch(function () {});
        } catch (e) {}
    }

    function syncFromAccount() {
        if (!hasAuthUser()) return;
        try {
            fetch(ACCOUNT_ENDPOINT, {
                credentials: 'include',
                cache: 'no-store',
                headers: { 'Accept': 'application/json' }
            }).then(function (response) {
                return response.ok ? response.json() : null;
            }).then(function (data) {
                if (!data || !isSupported(data.language)) return;
                var accountLanguage = String(data.language).toLowerCase();
                if (!localChoice) {
                    if (accountLanguage !== currentLanguage) {
                        setLanguage(accountLanguage, { persist: false, silent: true });
                    }
                    return;
                }
                // First visit of a signed-in browser that already has a choice:
                // bind that choice to the account when it has none stored yet.
                if (data.language === 'en' && currentLanguage !== 'en' && !data.saved) {
                    saveToAccount(currentLanguage);
                }
            }).catch(function () {});
        } catch (e) {}
    }

    function onChange(callback) {
        if (typeof callback === 'function') listeners.push(callback);
    }

    function translate(text) {
        var key = normalize(text);
        if (!key) return text;
        var hit = lookup(key);
        if (hit == null) hit = lookupDynamic(key);
        return hit == null ? text : hit;
    }

    /* Template-aware translation: packs store phrases such as "{n}m ago" or
       "{name} is now available in {category}!", and callers pass the values. */
    function translateWith(text, vars) {
        var out = translate(text);
        if (!vars || typeof vars !== 'object') return out;
        return out.replace(/\{(\w+)\}/g, function (match, name) {
            return Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match;
        });
    }

    function watchCookieBanner() {
        var update = function (banner) {
            var visible = Boolean(banner && banner.classList.contains('show') && !banner.classList.contains('hidden'));
            if (visible) {
                var height = Math.round(banner.getBoundingClientRect().height);
                document.documentElement.style.setProperty('--zr-lang-bottom', (height + 30) + 'px');
            } else {
                document.documentElement.style.removeProperty('--zr-lang-bottom');
            }
        };
        var banner = document.querySelector('.cookie-banner');
        if (banner) {
            update(banner);
            new MutationObserver(function () { update(banner); }).observe(banner, { attributes: true, attributeFilter: ['class'] });
            return;
        }
        // auth.js injects the banner after load; lift the switcher once it appears.
        var finder = new MutationObserver(function () {
            var found = document.querySelector('.cookie-banner');
            if (!found) return;
            finder.disconnect();
            update(found);
            new MutationObserver(function () { update(found); }).observe(found, { attributes: true, attributeFilter: ['class'] });
        });
        if (document.body) finder.observe(document.body, { childList: true });
    }

    function start() {
        if (started) return;
        started = true;

        var downloadLanguage = readDownloadLanguage();
        var initial = downloadLanguage || readStoredLanguage();
        buildLauncher();
        watchDom();
        watchCookieBanner();

        setLanguage(initial, { persist: false, silent: true }).then(function () {
            if (!downloadLanguage) syncFromAccount();
        });

        window.addEventListener('zyrex:auth', function (event) {
            if (event && event.detail) syncFromAccount();
        });
    }

    window.ZyrexI18n = {
        languages: LANGUAGES.map(function (lang) {
            return { code: lang.code, name: lang.english, native: lang.native, dir: lang.dir };
        }),
        getLanguage: function () { return started ? currentLanguage : (readDownloadLanguage() || readStoredLanguage()); },
        isRtl: function () { return (LANG_BY_CODE[currentLanguage] || LANG_BY_CODE.en).dir === 'rtl'; },
        setLanguage: function (code, options) { return setLanguage(code, options); },
        translate: translate,
        format: translateWith,
        onChange: onChange,
        refresh: function () { renderAll(); },
        t: translate
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
        start();
    }
})();
