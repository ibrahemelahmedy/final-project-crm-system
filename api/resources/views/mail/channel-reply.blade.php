@extends('mail.layout')

@section('content')
    <p style="margin:0 0 14px; color:#64748B;">{{ __('mail.csat.ticket', ['subject' => $ticketSubject]) }}</p>
    <p style="margin:0 0 14px; white-space:pre-line;">{{ $body }}</p>
@endsection
