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
    var PACK_VERSION = '20';
    var ACCOUNT_ENDPOINT = '/api/profile/language';
    var AUTH_CACHE_KEY = 'zyrex_auth_user';

    var LANGUAGES = [
        { code: 'en', native: 'English', english: 'English', dir: 'ltr' },
        { code: 'tr', native: 'Türkçe', english: 'Turkish', dir: 'ltr' },
        { code: 'pt', native: 'Português', english: 'Portuguese', dir: 'ltr' },
        { code: 'es', native: 'Español', english: 'Spanish', dir: 'ltr' },
        { code: 'ko', native: '한국어', english: 'Korean', dir: 'ltr' },
        { code: 'zh', native: '中文', english: 'Chinese', dir: 'ltr' },
        { code: 'ar', native: 'العربية', english: 'Arabic', dir: 'rtl' },
        { code: 'ru', native: 'Русский', english: 'Russian', dir: 'ltr' }
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
            'COMMUNITY BOARD': 'TOPLULUK TAHTASI', 'DISCOVER': 'KEŞFET', 'Find a request': 'Bir istek bul', 'Filter the board': 'İstekleri filtrele',
            'Product details are filled by Scrapin automatically.': 'Ürün bilgileri Scrapin tarafından otomatik doldurulur.', 'Scrapin is loading product details…': 'Scrapin ürün bilgilerini yüklüyor…', 'Product details loaded from Scrapin.': 'Ürün bilgileri Scrapin ile yüklendi.', 'Scrapin could not read this product link.': 'Scrapin bu ürün bağlantısını okuyamadı.',
            'Product lookup failed. You can still fill the request manually.': 'Ürün bilgileri alınamadı. İsteği yine de elle doldurabilirsiniz.', 'Step 1: Resolving Profile': '1. Adım: Profil bulunuyor', 'Fetching creator name & avatar...': 'İçerik üreticisinin adı ve profil fotoğrafı alınıyor…', 'Profile Lookup Failed': 'Profil bulunamadı',
            'Profile Set': 'Profil eklendi', 'Lookup Failed': 'Arama başarısız', 'Retry Lookup': 'Yeniden dene', 'Scrapin could not resolve this profile right now. You can retry or enter creator details manually.': 'Scrapin şu anda bu profili bulamadı. Yeniden deneyebilir veya içerik üreticisi bilgilerini elle girebilirsiniz.',
            'This creator profile was not found by Scrapin.': 'Scrapin bu içerik üreticisi profilini bulamadı.', 'Scrapin could not process this profile URL.': 'Scrapin bu profil bağlantısını işleyemedi.', 'Scrapin is rate limiting profile lookups. Try again shortly.': 'Scrapin profil aramalarını geçici olarak sınırlıyor. Biraz sonra yeniden deneyin.', 'Scrapin took too long to resolve this creator. Try again.': 'Scrapin içerik üreticisini bulurken zaman aşımına uğradı. Yeniden deneyin.',
            'Scrapin could not resolve this creator right now.': 'Scrapin şu anda bu içerik üreticisini bulamadı.', 'This social profile URL is not supported.': 'Bu sosyal medya profil bağlantısı desteklenmiyor.'
        },
        es: {
            'COMMUNITY BOARD': 'TABLERO DE LA COMUNIDAD', 'DISCOVER': 'DESCUBRIR', 'Find a request': 'Encuentra una solicitud', 'Filter the board': 'Filtrar solicitudes',
            'Product details are filled by Scrapin automatically.': 'Scrapin completa automáticamente los datos del producto.', 'Scrapin is loading product details…': 'Scrapin está cargando los datos del producto…', 'Product details loaded from Scrapin.': 'Datos del producto cargados desde Scrapin.', 'Scrapin could not read this product link.': 'Scrapin no pudo leer este enlace de producto.',
            'Product lookup failed. You can still fill the request manually.': 'No se pudo encontrar el producto. Aún puedes completar la solicitud manualmente.', 'Step 1: Resolving Profile': 'Paso 1: Buscando el perfil', 'Fetching creator name & avatar...': 'Obteniendo el nombre y la foto del creador…', 'Profile Lookup Failed': 'No se pudo encontrar el perfil',
            'Profile Set': 'Perfil añadido', 'Lookup Failed': 'Búsqueda fallida', 'Retry Lookup': 'Reintentar búsqueda', 'Scrapin could not resolve this profile right now. You can retry or enter creator details manually.': 'Scrapin no pudo encontrar este perfil. Puedes intentarlo de nuevo o introducir los datos del creador manualmente.',
            'This creator profile was not found by Scrapin.': 'Scrapin no encontró este perfil de creador.', 'Scrapin could not process this profile URL.': 'Scrapin no pudo procesar este enlace de perfil.', 'Scrapin is rate limiting profile lookups. Try again shortly.': 'Scrapin está limitando temporalmente las búsquedas. Inténtalo de nuevo pronto.', 'Scrapin took too long to resolve this creator. Try again.': 'Scrapin tardó demasiado en encontrar este creador. Inténtalo de nuevo.',
            'Scrapin could not resolve this creator right now.': 'Scrapin no pudo encontrar a este creador en este momento.', 'This social profile URL is not supported.': 'Este enlace de perfil social no es compatible.'
        },
        pt: {
            'COMMUNITY BOARD': 'QUADRO DA COMUNIDADE', 'DISCOVER': 'DESCOBRIR', 'Find a request': 'Encontre um pedido', 'Filter the board': 'Filtrar pedidos',
            'Product details are filled by Scrapin automatically.': 'O Scrapin preenche os dados do produto automaticamente.', 'Scrapin is loading product details…': 'O Scrapin está carregando os dados do produto…', 'Product details loaded from Scrapin.': 'Dados do produto carregados pelo Scrapin.', 'Scrapin could not read this product link.': 'O Scrapin não conseguiu ler este link de produto.',
            'Product lookup failed. You can still fill the request manually.': 'Não foi possível buscar o produto. Você ainda pode preencher o pedido manualmente.', 'Step 1: Resolving Profile': 'Etapa 1: Localizando perfil', 'Fetching creator name & avatar...': 'Buscando o nome e a foto do criador…', 'Profile Lookup Failed': 'Perfil não encontrado',
            'Profile Set': 'Perfil adicionado', 'Lookup Failed': 'Falha na busca', 'Retry Lookup': 'Tentar novamente', 'Scrapin could not resolve this profile right now. You can retry or enter creator details manually.': 'O Scrapin não encontrou este perfil. Tente novamente ou informe os dados do criador manualmente.',
            'This creator profile was not found by Scrapin.': 'O Scrapin não encontrou este perfil de criador.', 'Scrapin could not process this profile URL.': 'O Scrapin não conseguiu processar este link de perfil.', 'Scrapin is rate limiting profile lookups. Try again shortly.': 'O Scrapin está limitando as buscas temporariamente. Tente novamente em instantes.', 'Scrapin took too long to resolve this creator. Try again.': 'O Scrapin demorou demais para localizar este criador. Tente novamente.',
            'Scrapin could not resolve this creator right now.': 'O Scrapin não conseguiu localizar este criador agora.', 'This social profile URL is not supported.': 'Este link de perfil social não é compatível.'
        },
        ru: {
            'COMMUNITY BOARD': 'ДОСКА СООБЩЕСТВА', 'DISCOVER': 'ОБЗОР', 'Find a request': 'Найти запрос', 'Filter the board': 'Фильтр запросов',
            'Product details are filled by Scrapin automatically.': 'Scrapin автоматически заполняет данные о продукте.', 'Scrapin is loading product details…': 'Scrapin загружает данные о продукте…', 'Product details loaded from Scrapin.': 'Данные о продукте загружены из Scrapin.', 'Scrapin could not read this product link.': 'Scrapin не смог прочитать эту ссылку на продукт.',
            'Product lookup failed. You can still fill the request manually.': 'Не удалось найти продукт. Запрос можно заполнить вручную.', 'Step 1: Resolving Profile': 'Шаг 1: поиск профиля', 'Fetching creator name & avatar...': 'Загружаем имя и фото автора…', 'Profile Lookup Failed': 'Профиль не найден',
            'Profile Set': 'Профиль добавлен', 'Lookup Failed': 'Поиск не удался', 'Retry Lookup': 'Повторить поиск', 'Scrapin could not resolve this profile right now. You can retry or enter creator details manually.': 'Scrapin не смог найти этот профиль. Повторите попытку или введите данные автора вручную.',
            'This creator profile was not found by Scrapin.': 'Scrapin не нашёл этот профиль автора.', 'Scrapin could not process this profile URL.': 'Scrapin не смог обработать ссылку на профиль.', 'Scrapin is rate limiting profile lookups. Try again shortly.': 'Scrapin временно ограничивает поиск профилей. Попробуйте позже.', 'Scrapin took too long to resolve this creator. Try again.': 'Scrapin слишком долго искал автора. Повторите попытку.',
            'Scrapin could not resolve this creator right now.': 'Scrapin не смог найти этого автора сейчас.', 'This social profile URL is not supported.': 'Эта ссылка на социальный профиль не поддерживается.'
        },
        ko: {
            'COMMUNITY BOARD': '커뮤니티 요청', 'DISCOVER': '둘러보기', 'Find a request': '요청 찾기', 'Filter the board': '요청 필터링',
            'Product details are filled by Scrapin automatically.': 'Scrapin이 제품 정보를 자동으로 채웁니다.', 'Scrapin is loading product details…': 'Scrapin이 제품 정보를 불러오는 중…', 'Product details loaded from Scrapin.': 'Scrapin에서 제품 정보를 불러왔습니다.', 'Scrapin could not read this product link.': 'Scrapin이 이 제품 링크를 읽지 못했습니다.',
            'Product lookup failed. You can still fill the request manually.': '제품을 찾지 못했습니다. 요청을 직접 작성할 수 있습니다.', 'Step 1: Resolving Profile': '1단계: 프로필 찾기', 'Fetching creator name & avatar...': '크리에이터 이름과 프로필 사진을 가져오는 중…', 'Profile Lookup Failed': '프로필을 찾지 못했습니다',
            'Profile Set': '프로필이 추가되었습니다', 'Lookup Failed': '검색 실패', 'Retry Lookup': '다시 검색', 'Scrapin could not resolve this profile right now. You can retry or enter creator details manually.': 'Scrapin이 지금 이 프로필을 찾지 못했습니다. 다시 시도하거나 크리에이터 정보를 직접 입력하세요.',
            'This creator profile was not found by Scrapin.': 'Scrapin에서 이 크리에이터 프로필을 찾지 못했습니다.', 'Scrapin could not process this profile URL.': 'Scrapin이 이 프로필 링크를 처리하지 못했습니다.', 'Scrapin is rate limiting profile lookups. Try again shortly.': 'Scrapin이 프로필 검색을 잠시 제한하고 있습니다. 잠시 후 다시 시도하세요.', 'Scrapin took too long to resolve this creator. Try again.': 'Scrapin이 크리에이터를 찾는 데 너무 오래 걸렸습니다. 다시 시도하세요.',
            'Scrapin could not resolve this creator right now.': 'Scrapin이 지금 이 크리에이터를 찾지 못했습니다.', 'This social profile URL is not supported.': '지원하지 않는 소셜 프로필 링크입니다.'
        },
        zh: {
            'COMMUNITY BOARD': '社区请求', 'DISCOVER': '发现', 'Find a request': '查找请求', 'Filter the board': '筛选请求',
            'Product details are filled by Scrapin automatically.': 'Scrapin 会自动填写产品信息。', 'Scrapin is loading product details…': 'Scrapin 正在加载产品信息…', 'Product details loaded from Scrapin.': '已从 Scrapin 加载产品信息。', 'Scrapin could not read this product link.': 'Scrapin 无法读取此产品链接。',
            'Product lookup failed. You can still fill the request manually.': '无法查找产品。你仍可手动填写请求。', 'Step 1: Resolving Profile': '第 1 步：查找主页', 'Fetching creator name & avatar...': '正在获取创作者名称和头像…', 'Profile Lookup Failed': '未找到主页',
            'Profile Set': '主页已添加', 'Lookup Failed': '查找失败', 'Retry Lookup': '重试查找', 'Scrapin could not resolve this profile right now. You can retry or enter creator details manually.': 'Scrapin 暂时无法查找此主页。请重试或手动填写创作者信息。',
            'This creator profile was not found by Scrapin.': 'Scrapin 未找到此创作者主页。', 'Scrapin could not process this profile URL.': 'Scrapin 无法处理此主页链接。', 'Scrapin is rate limiting profile lookups. Try again shortly.': 'Scrapin 暂时限制了主页查找频率，请稍后重试。', 'Scrapin took too long to resolve this creator. Try again.': 'Scrapin 查找创作者超时，请重试。',
            'Scrapin could not resolve this creator right now.': 'Scrapin 暂时无法查找此创作者。', 'This social profile URL is not supported.': '不支持此社交主页链接。'
        },
        ar: {
            'COMMUNITY BOARD': 'طلبات المجتمع', 'DISCOVER': 'اكتشف', 'Find a request': 'ابحث عن طلب', 'Filter the board': 'تصفية الطلبات',
            'Product details are filled by Scrapin automatically.': 'يملأ Scrapin تفاصيل المنتج تلقائيًا.', 'Scrapin is loading product details…': 'يجري Scrapin تحميل تفاصيل المنتج…', 'Product details loaded from Scrapin.': 'تم تحميل تفاصيل المنتج من Scrapin.', 'Scrapin could not read this product link.': 'تعذر على Scrapin قراءة رابط المنتج هذا.',
            'Product lookup failed. You can still fill the request manually.': 'تعذر العثور على المنتج. يمكنك إدخال الطلب يدويًا.', 'Step 1: Resolving Profile': 'الخطوة 1: البحث عن الملف الشخصي', 'Fetching creator name & avatar...': 'جارٍ جلب اسم المنشئ وصورته…', 'Profile Lookup Failed': 'تعذر العثور على الملف الشخصي',
            'Profile Set': 'تمت إضافة الملف الشخصي', 'Lookup Failed': 'فشل البحث', 'Retry Lookup': 'أعد البحث', 'Scrapin could not resolve this profile right now. You can retry or enter creator details manually.': 'تعذر على Scrapin العثور على هذا الملف الآن. أعد المحاولة أو أدخل بيانات المنشئ يدويًا.',
            'This creator profile was not found by Scrapin.': 'لم يعثر Scrapin على ملف هذا المنشئ.', 'Scrapin could not process this profile URL.': 'تعذر على Scrapin معالجة رابط الملف الشخصي.', 'Scrapin is rate limiting profile lookups. Try again shortly.': 'يحد Scrapin مؤقتًا من عمليات البحث. حاول مجددًا بعد قليل.', 'Scrapin took too long to resolve this creator. Try again.': 'استغرق Scrapin وقتًا طويلًا للعثور على المنشئ. حاول مجددًا.',
            'Scrapin could not resolve this creator right now.': 'تعذر على Scrapin العثور على هذا المنشئ الآن.', 'This social profile URL is not supported.': 'رابط الملف الاجتماعي هذا غير مدعوم.'
        }
    };

    /* Shared legal-page labels. The legal documents use the same site language
       preference as the rest of the app, including when a visitor switches
       language after the page has loaded. */
    var LEGAL_COPY = {
        tr: {'Anonymous Member':'Anonim Üye','Anonymous':'Anonim','No description provided':'Açıklama eklenmemiş','Legal library':'Yasal belgeler','At a glance':'Kısa bilgiler','The short version':'Kısaca','The short version: use Zyrex fairly, respect the people who make the things you download, and don\'t turn the platform into a weapon. Everything below is the long version of that sentence.':'Kısaca: Zyrex’i adil kullanın, indirdiğiniz içerikleri üreten kişilere saygı gösterin ve platformu kötüye kullanmayın. Aşağıda bu yaklaşımın ayrıntıları yer alıyor.','You should be able to read this in one sitting and know exactly what we store, what we don\'t, and how to ask us to delete it.':'Bu politikayı okuyarak hangi bilgileri sakladığımızı, hangilerini saklamadığımızı ve silme talebinde nasıl bulunacağınızı öğrenebilirsiniz.','Zyrex indexes leaks, plugins and audios that members upload. We have a clear process for copyright holders to request removal and for uploaders to challenge an incorrect takedown.':'Zyrex, üyelerin yüklediği sızıntıları, eklentileri ve sesleri kataloglar. Telif hakkı sahiplerinin kaldırma talebi göndermesi ve yükleyicilerin hatalı kaldırmalara itiraz etmesi için açık bir süreç uygular.','Takedown essentials':'Kaldırma talebinin temel bilgileri','Legal documents':'Yasal belgeler','Updated 25 October 2026':'Güncelleme: 25 Ekim 2026','Covers':'Kapsam','Minimum age':'Asgari yaş','Price':'Ücret','Material changes':'Önemli değişiklikler','Site, downloads, uploads, Discord':'Site, indirmeler, yüklemeler ve Discord','Free, supported by optional ad-gated passes':'Ücretsiz; isteğe bağlı reklam destekli erişimlerle','Announced 14 days before they apply':'Yürürlüğe girmeden 14 gün önce duyurulur','Terms':'Åartlar','Privacy':'Gizlilik'},
        es: {'Anonymous Member':'Miembro anónimo','Anonymous':'Anónimo','No description provided':'No se proporcionó ninguna descripción','Legal library':'Biblioteca legal','At a glance':'Resumen','The short version':'En resumen','The short version: use Zyrex fairly, respect the people who make the things you download, and don\'t turn the platform into a weapon. Everything below is the long version of that sentence.':'En resumen: usa Zyrex de forma justa, respeta a quienes crean lo que descargas y no utilices la plataforma para hacer daño. A continuación encontrarás todos los detalles.','You should be able to read this in one sitting and know exactly what we store, what we don\'t, and how to ask us to delete it.':'Al leer esta política sabrás qué datos guardamos, cuáles no y cómo solicitar que los eliminemos.','Zyrex indexes leaks, plugins and audios that members upload. We have a clear process for copyright holders to request removal and for uploaders to challenge an incorrect takedown.':'Zyrex cataloga filtraciones, plugins y audios subidos por miembros. Ofrecemos un proceso claro para solicitar retiradas por derechos de autor y para impugnar las que sean incorrectas.','Takedown essentials':'Datos para solicitar la retirada','Legal documents':'Documentos legales','Updated 25 October 2026':'Actualizado el 25 de octubre de 2026','Covers':'Abarca','Minimum age':'Edad mínima','Price':'Precio','Material changes':'Cambios importantes','Site, downloads, uploads, Discord':'Sitio, descargas, subidas y Discord','Free, supported by optional ad-gated passes':'Gratis, con pases opcionales financiados por anuncios','Announced 14 days before they apply':'Se anuncian 14 días antes de entrar en vigor','Terms':'Términos','Privacy':'Privacidad'},
        pt: {'Anonymous Member':'Membro anônimo','Anonymous':'Anônimo','No description provided':'Nenhuma descrição informada','Legal library':'Biblioteca jurídica','At a glance':'Resumo','The short version':'Em resumo','The short version: use Zyrex fairly, respect the people who make the things you download, and don\'t turn the platform into a weapon. Everything below is the long version of that sentence.':'Em resumo: use o Zyrex com responsabilidade, respeite quem cria o conteúdo que você baixa e não use a plataforma para prejudicar outras pessoas. Abaixo estão todos os detalhes.','You should be able to read this in one sitting and know exactly what we store, what we don\'t, and how to ask us to delete it.':'Ao ler esta política, você saberá quais dados guardamos, quais não guardamos e como solicitar a exclusão.','Zyrex indexes leaks, plugins and audios that members upload. We have a clear process for copyright holders to request removal and for uploaders to challenge an incorrect takedown.':'O Zyrex cataloga leaks, plugins e áudios enviados por membros. Temos um processo claro para titulares de direitos autorais solicitarem remoções e para quem enviou o conteúdo contestar uma remoção incorreta.','Takedown essentials':'Dados essenciais para remoção','Legal documents':'Documentos jurídicos','Updated 25 October 2026':'Atualizado em 25 de outubro de 2026','Covers':'Abrange','Minimum age':'Idade mínima','Price':'Preço','Material changes':'Alterações importantes','Site, downloads, uploads, Discord':'Site, downloads, envios e Discord','Free, supported by optional ad-gated passes':'Grátis, com passes opcionais apoiados por anúncios','Announced 14 days before they apply':'Anunciadas 14 dias antes de entrarem em vigor','Terms':'Termos','Privacy':'Privacidade'},
        ru: {'Anonymous Member':'Анонимный участник','Anonymous':'Анонимно','No description provided':'Описание не указано','Legal library':'Правовые документы','At a glance':'Кратко','The short version':'Коротко','The short version: use Zyrex fairly, respect the people who make the things you download, and don\'t turn the platform into a weapon. Everything below is the long version of that sentence.':'Кратко: пользуйтесь Zyrex честно, уважайте создателей скачиваемых материалов и не используйте платформу во вред. Ниже приведены подробности.','You should be able to read this in one sitting and know exactly what we store, what we don\'t, and how to ask us to delete it.':'Прочитав эту политику, вы узнаете, какие данные мы храним, какие не собираем и как запросить их удаление.','Zyrex indexes leaks, plugins and audios that members upload. We have a clear process for copyright holders to request removal and for uploaders to challenge an incorrect takedown.':'Zyrex каталогизирует сливы, плагины и аудио, загруженные участниками. Для правообладателей предусмотрен порядок подачи запросов на удаление, а для загрузивших — обжалования ошибочного удаления.','Takedown essentials':'Данные для запроса на удаление','Legal documents':'Правовые документы','Updated 25 October 2026':'Обновлено 25 октября 2026 г.','Covers':'Охватывает','Minimum age':'Минимальный возраст','Price':'Цена','Material changes':'Важные изменения','Site, downloads, uploads, Discord':'Сайт, загрузки, публикации и Discord','Free, supported by optional ad-gated passes':'Бесплатно; доступны дополнительные пропуска с рекламой','Announced 14 days before they apply':'Объявляются за 14 дней до вступления в силу','Terms':'Условия','Privacy':'Конфиденциальность'},
        ko: {'Anonymous Member':'익명 회원','Anonymous':'익명','No description provided':'설명이 없습니다','Legal library':'법률 문서','At a glance':'요약','The short version':'간단히 보기','The short version: use Zyrex fairly, respect the people who make the things you download, and don\'t turn the platform into a weapon. Everything below is the long version of that sentence.':'간단히 말해 Zyrex를 공정하게 이용하고, 다운로드한 자료의 제작자를 존중하며, 플랫폼을 악용하지 마세요. 자세한 내용은 아래에 설명되어 있습니다.','You should be able to read this in one sitting and know exactly what we store, what we don\'t, and how to ask us to delete it.':'이 정책에서 당사가 저장하는 정보와 저장하지 않는 정보, 삭제를 요청하는 방법을 확인할 수 있습니다.','Zyrex indexes leaks, plugins and audios that members upload. We have a clear process for copyright holders to request removal and for uploaders to challenge an incorrect takedown.':'Zyrex는 회원이 업로드한 유출 자료, 플러그인, 오디오를 분류합니다. 저작권자의 삭제 요청과 업로더의 잘못된 삭제 조치 이의 제기를 위한 절차를 운영합니다.','Takedown essentials':'삭제 요청 필수 정보','Legal documents':'법률 문서','Updated 25 October 2026':'2026년 10월 25일 업데이트','Covers':'적용 범위','Minimum age':'최소 연령','Price':'가격','Material changes':'중요 변경 사항','Site, downloads, uploads, Discord':'사이트, 다운로드, 업로드, Discord','Free, supported by optional ad-gated passes':'무료이며 선택형 광고 지원 이용권 제공','Announced 14 days before they apply':'시행 14일 전에 공지','Terms':'약관','Privacy':'개인정보'},
        zh: {'Anonymous Member':'匿名成员','Anonymous':'匿名','No description provided':'未提供描述','Legal library':'法律文件','At a glance':'概要','The short version':'简要说明','The short version: use Zyrex fairly, respect the people who make the things you download, and don\'t turn the platform into a weapon. Everything below is the long version of that sentence.':'简而言之：公平使用 Zyrex，尊重你下载内容的创作者，不要滥用平台。下文将详细说明这些要求。','You should be able to read this in one sitting and know exactly what we store, what we don\'t, and how to ask us to delete it.':'阅读本政策后，你可以了解我们保存和不保存哪些信息，以及如何申请删除。','Zyrex indexes leaks, plugins and audios that members upload. We have a clear process for copyright holders to request removal and for uploaders to challenge an incorrect takedown.':'Zyrex 对会员上传的泄漏内容、插件和音频进行编目。我们为版权所有者提供明确的删除申请流程，也允许上传者对错误的删除提出异议。','Takedown essentials':'下架申请必备信息','Legal documents':'法律文件','Updated 25 October 2026':'更新于 2026 年 10 月 25 日','Covers':'适用范围','Minimum age':'最低年龄','Price':'价格','Material changes':'重大变更','Site, downloads, uploads, Discord':'网站、下载、上传和 Discord','Free, supported by optional ad-gated passes':'免费，另提供可选广告支持通行证','Announced 14 days before they apply':'生效前 14 天公布','Terms':'条款','Privacy':'隐私'},
        ar: {'Anonymous Member':'عضو مجهول','Anonymous':'مجهول','No description provided':'لم يتم تقديم وصف','Legal library':'المكتبة القانونية','At a glance':'نظرة سريعة','The short version':'باختصار','The short version: use Zyrex fairly, respect the people who make the things you download, and don\'t turn the platform into a weapon. Everything below is the long version of that sentence.':'باختصار: استخدم Zyrex بنزاهة، واحترم صانعي المواد التي تنزّلها، ولا تُسئ استخدام المنصة. توضح الأقسام التالية التفاصيل.','You should be able to read this in one sitting and know exactly what we store, what we don\'t, and how to ask us to delete it.':'توضح هذه السياسة البيانات التي نحتفظ بها والتي لا نحتفظ بها، وكيفية طلب حذفها.','Zyrex indexes leaks, plugins and audios that members upload. We have a clear process for copyright holders to request removal and for uploaders to challenge an incorrect takedown.':'يفهرس Zyrex التسريبات والإضافات والملفات الصوتية التي يرفعها الأعضاء. لدينا إجراءات واضحة لطلبات الإزالة من أصحاب الحقوق وللاعتراض على الإزالة الخاطئة.','Takedown essentials':'المعلومات اللازمة لطلب الإزالة','Legal documents':'المستندات القانونية','Updated 25 October 2026':'آخر تحديث: 25 أكتوبر 2026','Covers':'يشمل','Minimum age':'الحد الأدنى للعمر','Price':'السعر','Material changes':'التغييرات المهمة','Site, downloads, uploads, Discord':'الموقع والتنزيلات والرفع وDiscord','Free, supported by optional ad-gated passes':'مجاني مع تصاريح اختيارية مدعومة بالإعلانات','Announced 14 days before they apply':'يُعلن عنها قبل 14 يومًا من سريانها','Terms':'الشروط','Privacy':'الخصوصية'}
    };
    Object.keys(LEGAL_COPY).forEach(function (code) { Object.assign(PAGE_COPY[code], LEGAL_COPY[code]); });
    var LEGAL_EXTRA_COPY = {
        tr: {
            'The short version: use Zyrex fairly, respect the people who make the things you download, and don\'t turn the platform into a weapon. Everything below is the long version of that sentence.': 'Kısaca: Zyrex’i adil kullanın, indirdiğiniz içerikleri üreten kişilere saygı gösterin ve platformu kötüye kullanmayın. Aşağıda bu yaklaşımın ayrıntıları yer alıyor.',
            'You should be able to read this in one sitting and know exactly where you stand. Here is what Zyrex stores, why it exists, how long it stays, and how to have it erased.': 'Bu politikayı okuyarak hangi bilgileri sakladığımızı, bunları neden kullandığımızı, ne kadar süre tuttuğumuzu ve nasıl sildirebileceğinizi öğrenebilirsiniz.',
            'Zyrex indexes leaks, plugins and audios that members upload. We don\'t pretend otherwise — and we don\'t hide behind it. If something here is yours and you want it gone, one clear notice is all it takes.': 'Zyrex üyelerin yüklediği sızıntıları, eklentileri ve sesleri kataloglar. Bu durumu gizlemiyoruz. Buradaki bir içerik size aitse ve kaldırılmasını istiyorsanız, açık bir bildirim göndermeniz yeterlidir.',
            'Translations are provided for convenience; the English version controls if there is a discrepancy.': 'Çeviriler kolaylık sağlamak amacıyla sunulmuştur; farklılık olması hâlinde İngilizce metin esas alınır.'
        },
        es: {
            'The short version: use Zyrex fairly, respect the people who make the things you download, and don\'t turn the platform into a weapon. Everything below is the long version of that sentence.': 'En resumen: usa Zyrex de forma justa, respeta a quienes crean lo que descargas y no utilices la plataforma para hacer daño. A continuación encontrarás todos los detalles.',
            'You should be able to read this in one sitting and know exactly where you stand. Here is what Zyrex stores, why it exists, how long it stays, and how to have it erased.': 'Al leer esta política sabrás qué datos guarda Zyrex, por qué, durante cuánto tiempo y cómo solicitar que se eliminen.',
            'Zyrex indexes leaks, plugins and audios that members upload. We don\'t pretend otherwise — and we don\'t hide behind it. If something here is yours and you want it gone, one clear notice is all it takes.': 'Zyrex cataloga filtraciones, plugins y audios que suben sus miembros. No lo ocultamos. Si algo de aquí te pertenece y quieres que lo retiremos, basta con enviar una notificación clara.',
            'Translations are provided for convenience; the English version controls if there is a discrepancy.': 'Las traducciones se ofrecen a modo informativo; en caso de discrepancia, prevalece el texto en inglés.'
        },
        pt: {
            'The short version: use Zyrex fairly, respect the people who make the things you download, and don\'t turn the platform into a weapon. Everything below is the long version of that sentence.': 'Em resumo: use o Zyrex com responsabilidade, respeite quem cria o conteúdo que você baixa e não use a plataforma para prejudicar outras pessoas. Abaixo estão todos os detalhes.',
            'You should be able to read this in one sitting and know exactly where you stand. Here is what Zyrex stores, why it exists, how long it stays, and how to have it erased.': 'Ao ler esta política, você saberá quais dados o Zyrex guarda, por que os guarda, por quanto tempo e como solicitar a exclusão.',
            'Zyrex indexes leaks, plugins and audios that members upload. We don\'t pretend otherwise — and we don\'t hide behind it. If something here is yours and you want it gone, one clear notice is all it takes.': 'O Zyrex cataloga leaks, plugins e áudios enviados pelos membros. Não escondemos isso. Se algum conteúdo aqui é seu e você quer removê-lo, basta enviar uma notificação clara.',
            'Translations are provided for convenience; the English version controls if there is a discrepancy.': 'As traduções são fornecidas por conveniência; em caso de divergência, prevalece o texto em inglês.'
        },
        ru: {
            'The short version: use Zyrex fairly, respect the people who make the things you download, and don\'t turn the platform into a weapon. Everything below is the long version of that sentence.': 'Кратко: пользуйтесь Zyrex честно, уважайте создателей скачиваемых материалов и не используйте платформу во вред. Ниже приведены подробности.',
            'You should be able to read this in one sitting and know exactly where you stand. Here is what Zyrex stores, why it exists, how long it stays, and how to have it erased.': 'Прочитав эту политику, вы узнаете, какие данные хранит Zyrex, зачем и как долго, а также как запросить их удаление.',
            'Zyrex indexes leaks, plugins and audios that members upload. We don\'t pretend otherwise — and we don\'t hide behind it. If something here is yours and you want it gone, one clear notice is all it takes.': 'Zyrex каталогизирует сливы, плагины и аудио, загруженные участниками. Мы этого не скрываем. Если материал принадлежит вам и вы хотите его удалить, отправьте нам ясное уведомление.',
            'Translations are provided for convenience; the English version controls if there is a discrepancy.': 'Переводы предоставлены для удобства; при расхождениях преимущественную силу имеет текст на английском языке.'
        },
        ko: {
            'The short version: use Zyrex fairly, respect the people who make the things you download, and don\'t turn the platform into a weapon. Everything below is the long version of that sentence.': '간단히 말해 Zyrex를 공정하게 이용하고, 다운로드한 자료의 제작자를 존중하며, 플랫폼을 악용하지 마세요. 자세한 내용은 아래에 설명되어 있습니다.',
            'You should be able to read this in one sitting and know exactly where you stand. Here is what Zyrex stores, why it exists, how long it stays, and how to have it erased.': '이 정책에서 Zyrex가 어떤 정보를 왜, 얼마나 오래 보관하는지와 삭제를 요청하는 방법을 확인할 수 있습니다.',
            'Zyrex indexes leaks, plugins and audios that members upload. We don\'t pretend otherwise — and we don\'t hide behind it. If something here is yours and you want it gone, one clear notice is all it takes.': 'Zyrex는 회원이 올린 유출 자료, 플러그인, 오디오를 분류합니다. 이를 숨기지 않습니다. 여기 있는 자료가 본인 소유이고 삭제를 원한다면 명확한 통지를 보내 주세요.',
            'Translations are provided for convenience; the English version controls if there is a discrepancy.': '번역은 편의를 위해 제공됩니다. 번역 내용이 다를 경우 영어 원문이 우선합니다.'
        },
        zh: {
            'The short version: use Zyrex fairly, respect the people who make the things you download, and don\'t turn the platform into a weapon. Everything below is the long version of that sentence.': '简而言之：公平使用 Zyrex，尊重你下载内容的创作者，不要滥用平台。下文将详细说明这些要求。',
            'You should be able to read this in one sitting and know exactly where you stand. Here is what Zyrex stores, why it exists, how long it stays, and how to have it erased.': '阅读本政策后，你可以了解 Zyrex 保存哪些信息、保存原因和期限，以及如何申请删除。',
            'Zyrex indexes leaks, plugins and audios that members upload. We don\'t pretend otherwise — and we don\'t hide behind it. If something here is yours and you want it gone, one clear notice is all it takes.': 'Zyrex 对会员上传的泄漏内容、插件和音频进行编目。我们对此不作掩饰。如果这里的内容属于你且希望删除，请提交一份明确的通知。',
            'Translations are provided for convenience; the English version controls if there is a discrepancy.': '译文仅为方便阅读而提供；如有差异，以英文原文为准。'
        },
        ar: {
            'The short version: use Zyrex fairly, respect the people who make the things you download, and don\'t turn the platform into a weapon. Everything below is the long version of that sentence.': 'باختصار: استخدم Zyrex بنزاهة، واحترم صانعي المواد التي تنزّلها، ولا تُسئ استخدام المنصة. توضح الأقسام التالية التفاصيل.',
            'You should be able to read this in one sitting and know exactly where you stand. Here is what Zyrex stores, why it exists, how long it stays, and how to have it erased.': 'توضح هذه السياسة البيانات التي يحتفظ بها Zyrex وأسباب الاحتفاظ بها ومدته، وكيفية طلب حذفها.',
            'Zyrex indexes leaks, plugins and audios that members upload. We don\'t pretend otherwise — and we don\'t hide behind it. If something here is yours and you want it gone, one clear notice is all it takes.': 'يفهرس Zyrex التسريبات والإضافات والملفات الصوتية التي يرفعها الأعضاء، ولا نخفي ذلك. إذا كان محتوى هنا ملكًا لك وتريد إزالته، فأرسل إشعارًا واضحًا.',
            'Translations are provided for convenience; the English version controls if there is a discrepancy.': 'تُقدَّم الترجمات للتيسير؛ وعند وجود اختلاف يُعتد بالنص الإنجليزي.'
        }
    };
    Object.keys(LEGAL_EXTRA_COPY).forEach(function (code) { Object.assign(PAGE_COPY[code], LEGAL_EXTRA_COPY[code]); });

    Object.assign(PAGE_COPY.tr, {
        'Partner / File Converter': 'Ortak / Dosya Dönüştürücü',
        'Convert files that do not match your software version and make them compatible with Helix Converter.': 'Yazılım sürümünüzle uyuşmayan dosyaları Helix Converter ile uyumlu hâle getirin.',
        'Download Helix Converter': 'Helix Converter’ı indir'
    });
    Object.assign(PAGE_COPY.es, {
        'Partner / File Converter': 'Socio / Conversor de archivos',
        'Convert files that do not match your software version and make them compatible with Helix Converter.': 'Convierte archivos incompatibles con tu versión de software usando Helix Converter.',
        'Download Helix Converter': 'Descargar Helix Converter'
    });
    Object.assign(PAGE_COPY.pt, {
        'Partner / File Converter': 'Parceiro / Conversor de arquivos',
        'Convert files that do not match your software version and make them compatible with Helix Converter.': 'Converta arquivos incompatíveis com sua versão usando o Helix Converter.',
        'Download Helix Converter': 'Baixar Helix Converter'
    });
    Object.assign(PAGE_COPY.ru, {
        'Partner / File Converter': 'Партнёр / Конвертер файлов',
        'Convert files that do not match your software version and make them compatible with Helix Converter.': 'Конвертируйте файлы, несовместимые с вашей версией программы, с помощью Helix Converter.',
        'Download Helix Converter': 'Скачать Helix Converter'
    });
    Object.assign(PAGE_COPY.ko, {
        'Partner / File Converter': '파트너 / 파일 변환기',
        'Convert files that do not match your software version and make them compatible with Helix Converter.': 'Helix Converter로 사용 중인 소프트웨어 버전과 호환되지 않는 파일을 변환하세요.',
        'Download Helix Converter': 'Helix Converter 다운로드'
    });
    Object.assign(PAGE_COPY.zh, {
        'Partner / File Converter': '合作伙伴 / 文件转换器',
        'Convert files that do not match your software version and make them compatible with Helix Converter.': '使用 Helix Converter 转换与当前软件版本不兼容的文件。',
        'Download Helix Converter': '下载 Helix Converter'
    });
    Object.assign(PAGE_COPY.ar, {
        'Partner / File Converter': 'شريك / محوّل ملفات',
        'Convert files that do not match your software version and make them compatible with Helix Converter.': 'حوّل الملفات غير المتوافقة مع إصدار برنامجك باستخدام Helix Converter.',
        'Download Helix Converter': 'تنزيل Helix Converter'
    });
    var APPLY_COPY = {
        tr: ['Açık bir rol seç. Sana Discord üzerinden ulaşacağız.', 'Düzenleme kaynaklarını incele ve yayınla.', 'Sohbetlerin faydalı ve sıcak kalmasına yardımcı ol.', 'Åimdi başvur', 'Başvuru için Discord hesabı gerekir.'],
        es: ['Elige un puesto disponible. Te contactaremos por Discord.', 'Revisa y publica recursos de edición.', 'Ayuda a mantener conversaciones útiles y acogedoras.', 'Solicitar ahora', 'Necesitas una cuenta de Discord para solicitarlo.'],
        pt: ['Escolha uma vaga aberta. Entraremos em contato pelo Discord.', 'Revise e publique recursos de edição.', 'Ajude a manter as conversas úteis e acolhedoras.', 'Candidatar-se', 'Você precisa de uma conta do Discord para se candidatar.'],
        ru: ['Выберите открытую роль. Мы свяжемся с вами в Discord.', 'Проверяйте и публикуйте материалы для монтажа.', 'Помогайте поддерживать полезное и дружелюбное общение.', 'Подать заявку', 'Для подачи заявки нужна учётная запись Discord.'],
        ko: ['열려 있는 역할을 선택하세요. Discord로 연락드릴게요.', '편집 자료를 검토하고 게시하세요.', '유익하고 따뜻한 대화를 만들어 주세요.', '지금 지원하기', '지원하려면 Discord 계정이 필요합니다.'],
        zh: ['选择一个开放职位。我们会通过 Discord 联系你。', '审核并发布剪辑资源。', '帮助社区保持友好且有帮助的交流。', '立即申请', '申请需要 Discord 账号。'],
        ar: ['اختر دورًا متاحًا. سنتواصل معك عبر Discord.', 'راجع موارد التحرير وانشرها.', 'ساعد في إبقاء النقاشات مفيدة ومرحّبة.', 'قدّم الآن', 'تحتاج إلى حساب Discord للتقديم.']
    };
    var applyKeys = ['Choose an open role. We’ll contact you on Discord.', 'Review and publish editing resources.', 'Keep discussions useful and welcoming.', 'Apply now', 'You’ll need a Discord account.'];
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
        tr: ['Düzenleme sızıntılarını bulun, kontrol edin ve yayınlayın.', 'Akışta, yorumlarda ve Discord’da sakin ve konuya bağlı bir ortam sağlayın.', 'Yalnızca kendinizin kontrol ettiği dosyaları yükleyin.', 'Asıl içerik üreticisine kaynak belirtin.', 'Başlık, kategori, etiket ve küçük resmi doldurun.', 'Listede bulunan içerikleri yeniden yüklemeyin.', 'Åüpheli içerikleri kurucuya iletin.', 'Ekip üyeleri de dahil herkes için aynı kurallar geçerlidir.', 'Her uyarı, susturma ve yasaklama işlemini gerekçesiyle kaydedin.', 'Üye verilerini veya özel DM ekran görüntülerini paylaşmayın.', 'Kararlarınızı açıklayın; emin olmadığınız durumları kurucuya iletin.', 'Herkese açık tartışmalarda tarafsız kalın.', 'Sızıntı dosyalarınızın kaynakları neler?', 'Bir dosyayı yayınlamadan önce nasıl kontrol edersiniz?', 'Hangi düzenleme uygulamalarına hâkimsiniz?', 'Bir üye uyarılmasına rağmen kuralları çiğnemeye devam ederse ne yaparsınız?', 'Bir rapor ekipteki arkadaşınızı hedef alıyorsa ne yaparsınız?', 'Genellikle hangi saatlerde çevrimiçisiniz?'],
        es: ['Busca, revisa y publica recursos de edición filtrados.', 'Mantén el feed, los comentarios y Discord tranquilos y centrados.', 'Sube solo archivos que hayas revisado personalmente.', 'Da crédito al creador original.', 'Completa el título, la categoría, las etiquetas y la miniatura.', 'No vuelvas a subir contenido que ya esté publicado.', 'Envía cualquier archivo sospechoso al fundador.', 'Las mismas reglas se aplican a todos, incluido el equipo.', 'Registra cada aviso, silencio y expulsión con un motivo.', 'No compartas datos de miembros ni capturas de mensajes privados.', 'Explica tus decisiones y consulta los casos dudosos con el fundador.', 'Mantén la neutralidad en las discusiones públicas.', '¿De dónde proceden tus filtraciones?', '¿Cómo revisas un archivo antes de publicarlo?', '¿Qué aplicaciones de edición dominas?', '¿Qué harías si alguien sigue incumpliendo las reglas tras un aviso?', '¿Qué harías si un informe señala a un amigo del equipo?', '¿Cuándo sueles estar en línea?'],
        pt: ['Encontre, verifique e publique materiais de edição.', 'Mantenha o feed, os comentários e o Discord tranquilos e focados.', 'Envie apenas arquivos que você mesmo verificou.', 'Dê crédito ao criador original.', 'Preencha título, categoria, tags e miniatura.', 'Não envie novamente algo que já esteja listado.', 'Encaminhe qualquer arquivo suspeito ao fundador.', 'As mesmas regras valem para todos, inclusive a equipe.', 'Registre cada aviso, silenciamento e banimento com o motivo.', 'Nunca compartilhe dados de membros ou capturas de DMs privadas.', 'Explique as decisões e encaminhe dúvidas ao fundador.', 'Mantenha a neutralidade em discussões públicas.', 'De onde vêm seus vazamentos?', 'Como você verifica um arquivo antes de publicá-lo?', 'Quais aplicativos de edição você conhece bem?', 'O que fazer se alguém continuar quebrando as regras após um aviso?', 'O que você faria se uma denúncia apontasse para um amigo da equipe?', 'Quando você costuma estar online?'],
        ru: ['Находите, проверяйте и публикуйте материалы для монтажа.', 'Поддерживайте спокойное общение по теме в ленте, комментариях и Discord.', 'Загружайте только файлы, которые проверили сами.', 'Указывайте автора оригинала.', 'Заполняйте название, категорию, теги и миниатюру.', 'Не загружайте повторно уже опубликованные материалы.', 'Подозрительные файлы отправляйте основателю.', 'Правила одинаковы для всех, включая команду.', 'Фиксируйте предупреждения, тайм-ауты и блокировки с причиной.', 'Не публикуйте данные участников и скриншоты личных сообщений.', 'Объясняйте решения и передавайте спорные случаи основателю.', 'Сохраняйте нейтралитет в публичных спорах.', 'Откуда у вас материалы?', 'Как вы проверяете файл перед публикацией?', 'В каких программах для монтажа вы хорошо разбираетесь?', 'Что вы сделаете, если участник продолжит нарушать правила после предупреждения?', 'Что вы сделаете, если жалоба касается вашего друга из команды?', 'Когда вы обычно бываете в сети?'],
        ko: ['편집 자료를 찾고 확인한 뒤 게시하세요.', '피드, 댓글, Discord에서 차분하고 주제에 맞는 분위기를 유지하세요.', '직접 확인한 파일만 업로드하세요.', '원작자를 표시하세요.', '제목, 카테고리, 태그, 썸네일을 입력하세요.', '이미 등록된 파일을 다시 업로드하지 마세요.', '의심스러운 파일은 운영자에게 전달하세요.', '운영진을 포함해 모두에게 같은 규칙을 적용하세요.', '경고, 타임아웃, 차단을 사유와 함께 기록하세요.', '회원 정보나 비공개 DM 스크린샷을 공유하지 마세요.', '결정 이유를 설명하고 애매한 사례는 운영자에게 전달하세요.', '공개 논쟁에서 중립을 지키세요.', '자료는 어디에서 구하나요?', '게시 전에 파일을 어떻게 확인하나요?', '어떤 편집 앱을 잘 다루나요?', '경고 후에도 규칙을 어기는 회원에게 어떻게 대응하나요?', '팀 친구가 신고 대상이라면 어떻게 처리하나요?', '주로 언제 온라인인가요?'],
        zh: ['查找、检查并发布剪辑资源。', '让动态、评论和 Discord 保持平和并围绕主题。', '只上传自己检查过的文件。', '注明原作者。', '填写标题、分类、标签和缩略图。', '不要重复上传已经收录的内容。', '发现可疑文件时请交给创始人处理。', '所有人都遵守相同规则，包括团队成员。', '记录每次警告、禁言和封禁及其原因。', '不要分享成员数据或私人 DM 截图。', '解释处理决定，并将不确定的情况交给创始人。', '在公开争论中保持中立。', '你的资源来自哪里？', '发布前如何检查文件？', '你熟悉哪些剪辑软件？', '成员警告后仍持续违规，你会怎么处理？', '如果举报对象是团队中的朋友，你会怎么做？', '你通常什么时候在线？'],
        ar: ['اعثر على موارد المونتاج وافحصها وانشرها.', 'حافظ على هدوء النقاش وتركيزه في الخلاصة والتعليقات وDiscord.', 'ارفع الملفات التي تحققت منها بنفسك فقط.', 'اذكر صاحب المحتوى الأصلي.', 'أكمل العنوان والفئة والوسوم والصورة المصغّرة.', 'لا تُعد رفع المحتوى الموجود بالفعل.', 'أرسل الملفات المشبوهة إلى المؤسس.', 'القواعد واحدة للجميع، بما في ذلك فريق العمل.', 'سجّل كل تحذير وكتم وحظر مع ذكر السبب.', 'لا تشارك بيانات الأعضاء أو لقطات الرسائل الخاصة.', 'اشرح قراراتك وأحل الحالات غير الواضحة إلى المؤسس.', 'التزم الحياد في النقاشات العامة.', 'ما مصادر الملفات التي ترفعها؟', 'كيف تتحقق من الملف قبل نشره؟', 'ما تطبيقات المونتاج التي تتقنها؟', 'ماذا تفعل إذا واصل عضو مخالفة القواعد بعد التحذير؟', 'ماذا تفعل إذا أشار بلاغ إلى صديق في الفريق؟', 'متى تكون متصلاً عادةً؟']
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
            launcherButton.setAttribute('title', uiText('Language') + ' · ' + lang.native);
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
