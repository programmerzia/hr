<?php

namespace App\Support;

use App\Models\Employee;
use App\Models\User;

/**
 * Port of resources/js/app/nav.ts (navGroups + navFor). Icons are lucide-react component names.
 * Output: [{id, label?, items: [{id, label, to, icon}]}]
 */
final class Nav
{
    /** @return array<int, array<string, mixed>> */
    public static function groups(): array
    {
        $fullTime = fn (Employee $e, string $role) => $e->employment_type === 'full_time';
        $contractor = fn (Employee $e, string $role) => $e->employment_type === 'contractor' && $role !== 'management';

        return [
            ['id' => 'workspace', 'label' => 'Workspace', 'items' => [
                ['id' => 'home', 'label' => 'Home', 'to' => '/', 'icon' => 'House'],
                ['id' => 'my-day', 'label' => 'My day', 'to' => '/my-day', 'icon' => 'Clock'],
                ['id' => 'tasks', 'label' => 'My tasks', 'to' => '/tasks', 'icon' => 'CheckSquare'],
                ['id' => 'projects', 'label' => 'Projects', 'to' => '/projects', 'icon' => 'FolderKanban'],
                ['id' => 'leave', 'label' => 'Leave', 'to' => '/leave', 'icon' => 'CalendarDays'],
                ['id' => 'payslips', 'label' => 'Payslips', 'to' => '/payslips', 'icon' => 'ReceiptText', 'visible' => $fullTime],
                ['id' => 'my-claims', 'label' => 'Claims', 'to' => '/claims', 'icon' => 'Receipt', 'visible' => $contractor],
                ['id' => 'chat', 'label' => 'Chat', 'to' => '/chat', 'icon' => 'MessageSquare'],
                ['id' => 'inbox', 'label' => 'Inbox', 'to' => '/inbox', 'icon' => 'Inbox'],
            ]],
            ['id' => 'team', 'label' => 'Team', 'items' => [
                ['id' => 'team', 'label' => 'Team', 'to' => '/team', 'icon' => 'Users', 'permission' => 'view_team'],
                ['id' => 'team-history', 'label' => 'History', 'to' => '/team/history', 'icon' => 'History', 'permission' => 'view_team'],
                ['id' => 'regularizations', 'label' => 'Regularizations', 'to' => '/team/regularizations', 'icon' => 'ClipboardCheck', 'permission' => 'view_team'],
                ['id' => 'leave-approvals', 'label' => 'Leave approvals', 'to' => '/leave/approvals', 'icon' => 'CalendarCheck', 'permission' => ['approve_leave_lead', 'approve_leave_hr']],
                ['id' => 'team-sheet', 'label' => 'Month sheet', 'to' => '/team/sheet', 'icon' => 'Calendar', 'permission' => 'view_team'],
                ['id' => 'leave-calendar', 'label' => 'Calendar', 'to' => '/leave/calendar', 'icon' => 'Calendar', 'permission' => 'view_team'],
                // Finance shows Claims to approvers; avoid listing it twice.
                ['id' => 'claims', 'label' => 'Claims', 'to' => '/claims', 'icon' => 'Receipt', 'permission' => 'verify_claims', 'unless' => 'approve_claims'],
            ]],
            ['id' => 'people-pay', 'label' => 'People & pay', 'items' => [
                ['id' => 'people', 'label' => 'People', 'to' => '/people', 'icon' => 'UserRound', 'permission' => 'manage_people'],
                ['id' => 'payroll', 'label' => 'Payroll', 'to' => '/payroll', 'icon' => 'Wallet', 'permission' => 'manage_payroll'],
                ['id' => 'reports', 'label' => 'Reports', 'to' => '/reports', 'icon' => 'FileText', 'permission' => 'view_reports'],
            ]],
            ['id' => 'finance', 'label' => 'Finance', 'items' => [
                ['id' => 'clients', 'label' => 'Clients', 'to' => '/clients', 'icon' => 'Building2', 'permission' => 'manage_billing'],
                ['id' => 'invoices', 'label' => 'Invoices', 'to' => '/invoices', 'icon' => 'FileText', 'permission' => 'manage_billing'],
                ['id' => 'claims', 'label' => 'Claims', 'to' => '/claims', 'icon' => 'Receipt', 'permission' => 'approve_claims'],
            ]],
            ['id' => 'admin', 'items' => [
                ['id' => 'settings', 'label' => 'Settings', 'to' => '/settings', 'icon' => 'Settings', 'permission' => ['manage_policy', 'manage_access']],
            ]],
        ];
    }

    /** @return list<array<string, mixed>> */
    public static function for(User $user): array
    {
        $employee = $user->employee;
        $role = $user->role;
        $perms = Abilities::for($user);
        $has = fn (string|array $p) => array_intersect((array) $p, $perms) !== [];
        $out = [];
        foreach (self::groups() as $g) {
            $items = [];
            foreach ($g['items'] as $i) {
                if (isset($i['permission']) && ! $has($i['permission'])) {
                    continue;
                }
                if (isset($i['unless']) && $has($i['unless'])) {
                    continue;
                }
                if (isset($i['visible']) && (! $employee || ! ($i['visible'])($employee, $role))) {
                    continue;
                }
                $items[] = ['id' => $i['id'], 'label' => $i['label'], 'to' => $i['to'], 'icon' => $i['icon']];
            }
            if ($items) {
                $group = ['id' => $g['id']];
                if (isset($g['label'])) {
                    $group['label'] = $g['label'];
                }
                $group['items'] = $items;
                $out[] = $group;
            }
        }

        return $out;
    }
}
