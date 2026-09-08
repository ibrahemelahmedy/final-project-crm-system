<!doctype html>
<html lang="{{ $locale }}" dir="{{ $dir }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ $appName }}</title>
</head>
<body style="margin:0; padding:0; background-color:#F1F5F9; font-family: -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color:#0F172A;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F1F5F9;">
        <tr>
            <td align="center" style="padding:24px 12px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px; background-color:#FFFFFF; border-radius:8px; overflow:hidden;">
                    <tr>
                        <td style="background-color:{{ $primaryColor }}; padding:20px 28px; text-align:{{ $dir === 'rtl' ? 'right' : 'left' }};">
                            @if ($logoUrl)
                                <img src="{{ $logoUrl }}" alt="{{ $appName }}" style="max-height:40px; display:block;">
                            @else
                                <span style="color:#FFFFFF; font-size:20px; font-weight:700;">{{ $appName }}</span>
                            @endif
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:28px; text-align:{{ $dir === 'rtl' ? 'right' : 'left' }}; font-size:15px; line-height:1.6;">
                            @yield('content')
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:16px 28px; border-top:1px solid #E2E8F0; text-align:{{ $dir === 'rtl' ? 'right' : 'left' }}; color:#94A3B8; font-size:12px;">
                            {{ $appName }}
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
