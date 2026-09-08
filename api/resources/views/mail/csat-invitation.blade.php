@extends('mail.layout')

@section('content')
    <p style="margin:0 0 14px;">{{ __('mail.csat.greeting', ['name' => $customerName]) }}</p>
    <p style="margin:0 0 14px;">{{ __('mail.csat.intro') }}</p>
    <p style="margin:0 0 20px; color:#64748B;">{{ __('mail.csat.ticket', ['subject' => $ticketSubject]) }}</p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
        <tr>
            <td style="background-color:{{ $primaryColor }}; border-radius:6px;">
                <a href="{{ $url }}" style="display:inline-block; padding:12px 24px; color:#FFFFFF; font-weight:700; text-decoration:none;">
                    {{ __('mail.csat.cta') }}
                </a>
            </td>
        </tr>
    </table>

    <p style="margin:0 0 6px; color:#64748B; font-size:13px;">{{ __('mail.csat.fallback') }}</p>
    <p style="margin:0 0 14px; font-size:13px; word-break:break-all;"><span dir="ltr">{{ $url }}</span></p>
    <p style="margin:0; color:#94A3B8; font-size:12px;">{{ __('mail.csat.expiry', ['date' => $expiresAt]) }}</p>
@endsection
