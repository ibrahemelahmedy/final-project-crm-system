@extends('mail.layout')

@section('content')
    <p style="margin:0 0 14px;">{{ __('portal.mail.greeting') }}</p>
    <p style="margin:0 0 14px;">{{ __('portal.mail.code_intro') }}</p>
    <p style="margin:0 0 14px; font-size:28px; font-weight:700; letter-spacing:4px; color:{{ $primaryColor }};">
        <span dir="ltr">{{ $code }}</span>
    </p>
    <p style="margin:0 0 14px;">{{ __('portal.mail.expiry') }}</p>
    <p style="margin:0; color:#64748B; font-size:13px;">{{ __('portal.mail.ignore') }}</p>
@endsection
