<?php

namespace App\Policies;

use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\User;

/** Project lead, HR and management manage; members and managers write; members, leads, HR and management read. */
class ProjectPolicy
{
    private function manager(User $user): bool
    {
        return in_array($user->role, ['hr', 'management'], true);
    }

    public function isMember(User $user, Project $project): bool
    {
        return $user->employee_id !== null
            && ProjectMember::where('project_id', $project->id)->where('employee_id', $user->employee_id)->exists();
    }

    public function view(User $user, Project $project): bool
    {
        return $this->manager($user)
            || $project->lead_employee_id === $user->employee_id
            || $this->isMember($user, $project);
    }

    public function create(User $user): bool
    {
        return in_array($user->role, ['hr', 'management', 'team_lead'], true);
    }

    public function manage(User $user, Project $project): bool
    {
        return $this->manager($user) || ($user->employee_id !== null && $project->lead_employee_id === $user->employee_id);
    }

    public function write(User $user, Project $project): bool
    {
        return $this->manage($user, $project) || $this->isMember($user, $project);
    }
}
