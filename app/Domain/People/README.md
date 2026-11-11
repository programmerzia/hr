# People

Port one-to-one from `resources/js/mock/stores/people.ts` (same validation messages). Invokable classes in `Actions/`.

Actions to port:
- [ ] OnboardEmployee, UpdateEmployee, ChangeStatus, AddSalaryStructure, UpdateBankAccount
- [ ] ToggleChecklistItem, AddDocument, AddAsset, ResetPassword (temp password welcome123, must_change_password=true)
- ChangePassword is done in App\Http\Controllers\Account\PasswordController
