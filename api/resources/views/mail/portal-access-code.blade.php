<!doctype html>
<html>
<body style="font-family: sans-serif; color: #0F172A;">
    <p>{{ __('portal.mail.greeting') }}</p>
    <p>{{ __('portal.mail.code_intro') }}</p>
    <p style="font-size: 28px; font-weight: 700; letter-spacing: 4px;">
        <span dir="ltr">{{ $code }}</span>
    </p>
    <p>{{ __('portal.mail.expiry') }}</p>
    <p style="color: #64748B; font-size: 13px;">{{ __('portal.mail.ignore') }}</p>
</body>
</html>
