<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{{ $title }} {{ $label }}</title>
<style>
  @page { margin: 14mm; }
  body { font-family: DejaVu Sans, sans-serif; font-size: 10px; color: #1a1a1a; }
  h1 { font-size: 17px; margin: 0; }
  h2 { font-size: 11px; margin: 0 0 4px; }
  .muted { color: #666; }
  .right { text-align: right; }
  table { width: 100%; border-collapse: collapse; }
  td, th { padding: 3px 0; vertical-align: top; }
  .rule td { border-bottom: 1px solid #ddd; }
  .head { border-bottom: 2px solid #1a1a1a; padding-bottom: 8px; margin-bottom: 8px; }
  .box { border-top: 1px solid #1a1a1a; border-bottom: 1px solid #1a1a1a; padding: 6px 0; margin-top: 10px; }
  .strong td { font-weight: bold; border-top: 1px solid #999; }
  .col { width: 48%; vertical-align: top; }
</style>
</head>
<body>
@php($money = fn ($n) => number_format((int) $n))
@php($d = fn ($n) => rtrim(rtrim(number_format((float) $n, 1), '0'), '.'))
<table class="head"><tr>
  <td><h1>{{ $company }}</h1><div class="muted">{{ $title }} for {{ $label }}</div></td>
  <td class="right muted">
    @if($run->paid_at)Paid on {{ $run->paid_at->format('d M Y') }}<br>@endif
    @if($run->payment_reference)Reference {{ $run->payment_reference }}@endif
  </td>
</tr></table>

<table>
  <tr><td><span class="muted">Employee</span> {{ $employee->name }}</td><td><span class="muted">Employee ID</span> {{ $employee->code }}</td></tr>
  <tr><td><span class="muted">Designation</span> {{ $employee->designation }}</td><td><span class="muted">Department</span> {{ $department ?? '-' }}</td></tr>
  @if($run->kind !== 'festival')
  <tr><td><span class="muted">Payable days</span> {{ $d($item->eligible_days) }}</td>
      <td><span class="muted">Attendance</span> {{ intdiv($item->worked_minutes, 60) }}h {{ $item->worked_minutes % 60 }}m of {{ intdiv($item->standard_minutes, 60) }}h</td></tr>
  @if($item->lop_days > 0 || $item->absent_days + $item->half_days + $item->unpaid_leave_days > 0)
  <tr><td colspan="2"><span class="muted">Loss of pay</span> {{ $d($item->lop_days) }} days
    (absent {{ $d($item->absent_days) }}, half days {{ $d($item->half_days) }}, unpaid leave {{ $d($item->unpaid_leave_days) }})</td></tr>
  @endif
  @if($item->paid_leave_days > 0)<tr><td colspan="2"><span class="muted">Paid leave</span> {{ $d($item->paid_leave_days) }} days</td></tr>@endif
  @else
  <tr><td colspan="2"><span class="muted">Bonus</span> {{ $d($item->components['bonus_percent'] ?? $run->bonus_percent_of_basic) }}% of basic {{ $money($item->components['basic'] ?? 0) }}</td></tr>
  @endif
</table>

<table style="margin-top:10px"><tr>
<td class="col">
  <h2>Earnings</h2>
  <table>
    @if($run->kind === 'festival')
      <tr class="rule"><td>{{ $run->label ?: 'Festival bonus' }}</td><td class="right">{{ $money($item->gross) }}</td></tr>
    @elseif($item->components)
      <tr class="rule"><td>Basic</td><td class="right">{{ $money($item->components['basic'] ?? 0) }}</td></tr>
      <tr class="rule"><td>House rent</td><td class="right">{{ $money($item->components['house_rent'] ?? 0) }}</td></tr>
      <tr class="rule"><td>Medical</td><td class="right">{{ $money($item->components['medical'] ?? 0) }}</td></tr>
      <tr class="rule"><td>Conveyance</td><td class="right">{{ $money($item->components['conveyance'] ?? 0) }}</td></tr>
      @foreach(($item->components['other_allowances'] ?? []) as $o)
        <tr class="rule"><td>{{ $o['label'] }}</td><td class="right">{{ $money($o['amount']) }}</td></tr>
      @endforeach
    @else
      <tr class="rule"><td>Gross salary</td><td class="right">{{ $money($item->gross) }}</td></tr>
    @endif
    @if($item->leave_encashment > 0)<tr class="rule"><td>Leave encashment ({{ $d($item->components['encashment_days'] ?? 0) }} days)</td><td class="right">{{ $money($item->leave_encashment) }}</td></tr>@endif
    @if($item->overtime_pay > 0)<tr class="rule"><td>Overtime</td><td class="right">{{ $money($item->overtime_pay) }}</td></tr>@endif
    @foreach($bonuses as $a)<tr class="rule"><td>{{ $a->label }}</td><td class="right">{{ $money($a->amount) }}</td></tr>@endforeach
    <tr class="strong"><td>Total earnings</td><td class="right">{{ $money($totalEarnings) }}</td></tr>
  </table>
</td>
<td style="width:4%"></td>
<td class="col">
  <h2>Deductions</h2>
  <table>
    @if($showTax)<tr class="rule"><td>Income tax</td><td class="right">{{ $money($item->tax) }}</td></tr>@endif
    @if($showPf)<tr class="rule"><td>Provident fund</td><td class="right">{{ $money($item->pf) }}</td></tr>@endif
    @if($showLop)<tr class="rule"><td>Loss of pay ({{ $d($item->lop_days) }} days)</td><td class="right">{{ $money($item->unpaid_deduction) }}</td></tr>@endif
    @if($showLate)<tr class="rule"><td>Late penalty ({{ $d($item->late_penalty_days) }} days)</td><td class="right">{{ $money($item->late_deduction) }}</td></tr>@endif
    @foreach($deductionAdjustments as $a)<tr class="rule"><td>{{ $a->label }}</td><td class="right">{{ $money($a->amount) }}</td></tr>@endforeach
    <tr class="strong"><td>Total deductions</td><td class="right">{{ $money($totalDeductions) }}</td></tr>
  </table>
</td>
</tr></table>

@if(count($item->slices ?? []) > 1)
  <div style="margin-top:8px">
    <h2>Salary changes this month</h2>
    @foreach($item->slices as $sl)
      <div class="muted">From {{ \Illuminate\Support\Carbon::parse($sl['effective_from'])->format('d M Y') }}: {{ $d($sl['days']) }} days of {{ $money($sl['gross']) }} = {{ $money($sl['gross_share']) }}</div>
    @endforeach
  </div>
@endif
@if($item->pf_employer > 0)<div class="muted" style="margin-top:6px">Employer provident fund contribution {{ $money($item->pf_employer) }}</div>@endif

<table class="box"><tr>
  <td style="font-size:13px;font-weight:bold">Net pay (BDT)</td>
  <td class="right" style="font-size:15px;font-weight:bold">{{ $money($item->net) }}</td>
</tr></table>

<p class="muted" style="margin-top:10px">
  @if($bank)Paid to {{ $bank->account_name }}, {{ $bank->bank }} ({{ $bank->branch }}), account {{ $bankMasked }}.@else No bank account on file.@endif
</p>
<p class="muted">This payslip is computer generated and needs no signature.</p>
</body>
</html>
