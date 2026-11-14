// Zyrex — one controller for both staff roles. The page declares its role with
// data-staff-role, and the questions/rules come from the API so the form and the
// server always agree on what is being asked.
(function () {
    'use strict';

    var role = document.body.getAttribute('data-staff-role') || '';
    var $ = function (id) { return document.getElementById(id); };

    var form = $('applyForm');
    var gate = $('authGate');
    var statusCard = $('statusCard');
    var statusList = $('statusList');
    var questionHost = $('roleQuestions');
    var rulesHost = $('roleRules');
    var experienceToggle = $('experienceToggle');
    var experienceWrap = $('experienceWrap');
    var rulesAgree = $('rulesAgree');
    var formStatus = $('formStatus');
    var submitBtn = $('submitBtn');
    var closedNotice = $('closedNotice');

    var state = { hasExperience: null, submitting: false, schema: null, open: true };
    var questionPlaceholders = {
        en: { sources: 'Your own archive, trusted creators, or communities you know.', verification: 'Scan for malware, check the version, and open the project.', tools: 'After Effects, Premiere Pro, Photoshop, or similar apps.', conflict: 'Describe the steps you would take.', report: 'Explain how you would keep the process fair.', coverage: 'Evenings, weekends, or your time zone.' },
        tr: { sources: 'Kendi arşiviniz, güvendiğiniz üreticiler veya tanıdığınız topluluklar.', verification: 'Zararlı yazılım taraması yapın, sürümü kontrol edin ve projeyi açın.', tools: 'After Effects, Premiere Pro, Photoshop veya benzeri uygulamalar.', conflict: 'İzleyeceğiniz adımları anlatın.', report: 'Süreci nasıl adil tutacağınızı açıklayın.', coverage: 'Akşamlar, hafta sonları veya saat diliminiz.' },
        es: { sources: 'Tu archivo, creadores de confianza o comunidades que conoces.', verification: 'Analiza el archivo, comprueba la versión y abre el proyecto.', tools: 'After Effects, Premiere Pro, Photoshop u otras aplicaciones.', conflict: 'Describe los pasos que seguirías.', report: 'Explica cómo mantendrías un proceso justo.', coverage: 'Noches, fines de semana o tu zona horaria.' },
        pt: { sources: 'Seu arquivo, criadores de confiança ou comunidades que você conhece.', verification: 'Verifique malware, confira a versão e abra o projeto.', tools: 'After Effects, Premiere Pro, Photoshop ou aplicativos semelhantes.', conflict: 'Descreva as etapas que você seguiria.', report: 'Explique como manteria o processo justo.', coverage: 'Noites, fins de semana ou seu fuso horário.' },
        ru: { sources: 'Ваш архив, проверенные авторы или знакомые сообщества.', verification: 'Проверьте файл на вирусы, версию и откройте проект.', tools: 'After Effects, Premiere Pro, Photoshop и другие программы.', conflict: 'Опишите свои дальнейшие действия.', report: 'Расскажите, как вы обеспечите справедливость.', coverage: 'Вечера, выходные или ваш часовой пояс.' },
        ko: { sources: '개인 자료, 신뢰하는 제작자 또는 익숙한 커뮤니티.', verification: '악성 코드 검사, 버전 확인 후 프로젝트를 열어 보세요.', tools: 'After Effects, Premiere Pro, Photoshop 등.', conflict: '어떤 순서로 대응할지 설명하세요.', report: '공정하게 처리할 방법을 설명하세요.', coverage: '저녁, 주말 또는 시간대를 적어 주세요.' },
        zh: { sources: '自己的资料库、信任的创作者或熟悉的社区。', verification: '扫描恶意软件、核对版本并打开项目检查。', tools: 'After Effects、Premiere Pro、Photoshop 等。', conflict: '请描述你会采取的步骤。', report: '请说明你如何确保处理公平。', coverage: '晚上、周末或你的时区。' },
        ar: { sources: 'أرشيفك أو منشئو محتوى تثق بهم أو مجتمعات تعرفها.', verification: 'افحص الملف من البرمجيات الضارة وتحقق من الإصدار وافتح المشروع.', tools: 'After Effects أو Premiere Pro أو Photoshop وما شابهها.', conflict: 'اذكر الخطوات التي ستتبعها.', report: 'اشرح كيف ستحافظ على عدالة الإجراء.', coverage: 'المساء أو عطلة نهاية الأسبوع أو منطقتك الزمنية.' }
    };

    function updateQuestionPlaceholders() {
        var language = window.ZyrexI18n ? window.ZyrexI18n.getLanguage() : 'en';
        var translations = questionPlaceholders[language] || questionPlaceholders.en;
        document.querySelectorAll('[data-staff-placeholder-key]').forEach(function (field) {
            var key = field.getAttribute('data-staff-placeholder-key');
            if (translations[key]) field.setAttribute('placeholder', translations[key]);
        });
    }

    function clearErrors() {
        document.querySelectorAll('.staff-field-error').forEach(function (node) { node.textContent = ''; });
    }

    function fieldError(key, message) {
        var node = document.querySelector('[data-error-for="' + key + '"]');
        if (node) node.textContent = message;
    }

    function esc(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function renderRules(rules) {
        if (!rulesHost) return;
        rulesHost.innerHTML = (rules || []).map(function (rule) {
            return '<li><i class="fa-solid fa-check"></i> <span data-i18n="' + esc(rule) + '">' + esc(rule) + '</span></li>';
        }).join('');
    }

    function renderQuestions(questions) {
        if (!questionHost) return;
        questionHost.innerHTML = (questions || []).map(function (question) {
            var required = question.required ? '' : ' <span>(optional)</span>';
            return '<div class="staff-field">' +
                '<label for="q-' + esc(question.key) + '"><span data-i18n="' + esc(question.label) + '">' + esc(question.label) + '</span>' + required + '</label>' +
                '<textarea id="q-' + esc(question.key) + '" data-answer="' + esc(question.key) + '" data-staff-placeholder-key="' + esc(question.key) + '" rows="3" maxlength="' +
                esc(question.max || 600) + '" placeholder="' + esc(question.placeholder || '') + '"></textarea>' +
                '<p class="staff-field-error" data-error-for="' + esc(question.key) + '"></p>' +
                '</div>';
        }).join('');
        updateQuestionPlaceholders();
    }

    function paintRole(data) {
        var roles = (data && data.roles) || [];
        var meta = roles.filter(function (entry) { return entry.value === role; })[0];
        if (!meta) return;
        state.schema = meta;
        state.open = meta.open !== false;
        var titleNodes = document.querySelectorAll('[data-role-label]');
        titleNodes.forEach(function (node) { node.textContent = meta.label; });
        var blurbNodes = document.querySelectorAll('[data-role-blurb]');
        blurbNodes.forEach(function (node) { node.textContent = meta.blurb; });
        renderRules(meta.rules);
        renderQuestions(meta.questions);
        if (closedNotice) {
            closedNotice.hidden = state.open;
        }
        if (!state.open && submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Applications closed';
        }
    }

    function loadRole() {
        return fetch('/api/staff/settings', { credentials: 'include', cache: 'no-store' })
            .then(function (response) { return response.ok ? response.json() : null; })
            .then(function (data) { if (data && data.success) paintRole(data); })
            .catch(function () {});
    }

    function showStatusList(rows) {
        if (!rows || !rows.length) {
            statusCard.hidden = true;
            return;
        }
        var labels = { pending: 'Under review', accepted: 'Accepted', rejected: 'Not accepted', withdrawn: 'Withdrawn' };
        statusList.innerHTML = rows.filter(function (row) { return row.role === role; }).map(function (row) {
            var when = row.created_at ? new Date(row.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
            return '<li class="staff-status-item is-' + esc(row.status || 'pending') + '">' +
                '<div class="staff-status-main"><strong>' + esc(row.role_label || 'Staff') + '</strong><small>' + esc(when) + '</small></div>' +
                '<span class="staff-status-chip is-' + esc(row.status || 'pending') + '">' + esc(labels[row.status] || row.status) + '</span>' +
                (row.status === 'pending' ? '<button type="button" class="staff-btn" data-withdraw-application="' + esc(row.id) + '">Withdraw</button>' : '') +
                (row.decision_note ? '<p class="staff-status-note"><i class="fa-solid fa-quote-left"></i> ' + esc(row.decision_note) + '</p>' : '') +
                '</li>';
        }).join('');
        statusCard.hidden = !statusList.children.length;
    }

    statusList.addEventListener('click', function (event) {
        var button = event.target.closest('[data-withdraw-application]');
        if (!button || button.disabled) return;
        var id = button.getAttribute('data-withdraw-application');
        button.disabled = true;
        button.textContent = 'Withdrawing…';
        fetch('/api/staff/apply?id=' + encodeURIComponent(id), { method: 'DELETE', credentials: 'include', cache: 'no-store' })
            .then(function (response) { return response.json().then(function (data) { return { ok: response.ok, data: data }; }); })
            .then(function (result) {
                if (!result.ok || !result.data.success) throw new Error(result.data.error || 'Could not withdraw this application.');
                return loadMine();
            })
            .catch(function (error) {
                button.disabled = false;
                button.textContent = 'Withdraw';
                if (formStatus) { formStatus.textContent = error.message || 'Could not withdraw this application.'; formStatus.classList.add('is-error'); }
            });
    });

    function loadMine() {
        return fetch('/api/staff/apply', { credentials: 'include', cache: 'no-store' })
            .then(function (response) { return response.status === 401 ? null : response.json(); })
            .then(function (data) {
                if (!data || !data.success) return null;
                showStatusList(data.applications || []);
                return data;
            })
            .catch(function () { return null; });
    }

    function setSignedIn(user) {
        var signedIn = Boolean(user);
        gate.hidden = signedIn;
        form.hidden = !signedIn;
        if (!signedIn) statusCard.hidden = true;
        if (signedIn) loadMine();
    }

    window.addEventListener('zyrex:auth', function (event) { setSignedIn(event.detail); });
    if (window.currentUser) setSignedIn(window.currentUser);
    loadRole();

    experienceToggle.addEventListener('click', function (event) {
        var button = event.target.closest('[data-experience]');
        if (!button) return;
        state.hasExperience = button.getAttribute('data-experience') === 'yes';
        experienceToggle.querySelectorAll('[data-experience]').forEach(function (node) {
            var active = node === button;
            node.classList.toggle('is-active', active);
            node.setAttribute('aria-checked', active ? 'true' : 'false');
        });
        experienceWrap.hidden = !state.hasExperience;
        fieldError('has_experience', '');
        if (state.hasExperience) $('experienceDetails').focus();
    });

    function collectAnswers() {
        var answers = {};
        questionHost.querySelectorAll('[data-answer]').forEach(function (field) {
            answers[field.getAttribute('data-answer')] = field.value.trim();
        });
        return answers;
    }

    function validate(payload) {
        clearErrors();
        var ok = true;
        if (!state.open) { fieldError('role', 'This role is closed right now.'); ok = false; }
        if (payload.full_name.length < 2) { fieldError('full_name', 'Tell us your name.'); ok = false; }
        if (!Number.isInteger(payload.age) || payload.age < 13 || payload.age > 99) {
            fieldError('age', 'Enter an age between 13 and 99.');
            ok = false;
        }
        if (state.hasExperience === null) { fieldError('has_experience', 'Pick yes or no.'); ok = false; }
        if (state.hasExperience && payload.experience_details.length < 20) {
            fieldError('experience_details', 'Add a sentence or two about that experience.');
            ok = false;
        }
        (state.schema && state.schema.questions ? state.schema.questions : []).forEach(function (question) {
            var value = payload.answers[question.key] || '';
            if (question.required && value.length < (question.min || 1)) {
                fieldError(question.key, 'This answer needs a few more words.');
                ok = false;
            }
        });
        if (payload.motivation.length < 20) { fieldError('motivation', 'A couple of sentences, please.'); ok = false; }
        if (!payload.rules_agreed) { fieldError('rules', 'Tick the box to confirm you accept the rules.'); ok = false; }
        return ok;
    }

    form.addEventListener('submit', function (event) {
        event.preventDefault();
        if (state.submitting || !state.open) return;
        var payload = {
            role: role,
            full_name: $('fullName').value.trim(),
            age: Number($('age').value),
            timezone: $('timezone').value.trim(),
            hours_per_week: $('hours').value.trim(),
            has_experience: state.hasExperience === true,
            experience_details: $('experienceDetails').value.trim(),
            motivation: $('motivation').value.trim(),
            answers: collectAnswers(),
            rules_agreed: rulesAgree.checked === true
        };
        if (!validate(payload)) {
            var firstError = document.querySelector('.staff-field-error');
            if (firstError && firstError.scrollIntoView) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }
        state.submitting = true;
        submitBtn.disabled = true;
        formStatus.textContent = 'Sending your application…';
        formStatus.classList.remove('is-error');
        fetch('/api/staff/apply', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).then(function (response) {
            return response.json().then(function (data) { return { ok: response.ok, data: data }; });
        }).then(function (result) {
            if (!result.ok || !result.data.success) throw new Error(result.data.error || 'Your application could not be sent.');
            formStatus.textContent = 'Sent. We answer in your Discord DMs.';
            form.reset();
            state.hasExperience = null;
            experienceToggle.querySelectorAll('[data-experience]').forEach(function (node) { node.classList.remove('is-active'); node.setAttribute('aria-checked', 'false'); });
            experienceWrap.hidden = true;
            loadMine();
            loadRole();
            if (formStatus.scrollIntoView) formStatus.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }).catch(function (error) {
            formStatus.textContent = error.message || 'Your application could not be sent.';
            formStatus.classList.add('is-error');
            loadRole();
        }).finally(function () {
            state.submitting = false;
            submitBtn.disabled = !state.open;
        });
    });
    window.addEventListener('zyrex:languagechange', updateQuestionPlaceholders);
    (function bindI18n(attempt) {
        if (window.ZyrexI18n && typeof window.ZyrexI18n.onChange === 'function') {
            window.ZyrexI18n.onChange(updateQuestionPlaceholders);
            updateQuestionPlaceholders();
        } else if (attempt < 40) {
            window.setTimeout(function () { bindI18n(attempt + 1); }, 50);
        }
    })(0);
})();
