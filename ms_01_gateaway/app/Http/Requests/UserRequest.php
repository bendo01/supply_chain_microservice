<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Enums\RoleName;
use App\Models\User;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Used for both store (POST) and update (PUT/PATCH). */
final class UserRequest extends FormRequest
{
    /** @return array<string, mixed> */
    public function rules(): array
    {
        $creating = $this->isMethod('POST');
        $req = $creating ? 'required' : 'sometimes';
        /** @var User|null $user */
        $user = $this->route('user');

        return [
            'username' => [$req, 'string', 'max:255', Rule::unique('users', 'username')->ignore($user?->getKey())],
            'password' => [$req, 'string', 'min:8', 'max:255'],
            'full_name' => [$req, 'string', 'max:255'],
            'role' => [$req, Rule::enum(RoleName::class)],
            'retail_id' => ['nullable', 'uuid'],
            'warehouse_id' => ['nullable', 'uuid'],
            'supplier_id' => ['nullable', 'uuid'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            /** @var User|null $user */
            $user = $this->route('user');
            $roleValue = $this->input('role') ?? $user?->primaryRole();
            $role = is_string($roleValue) ? RoleName::tryFrom($roleValue) : null;
            if ($role === null) {
                return;
            }

            $column = $role->scopeColumn();
            $scopeValue = $this->has((string) $column) ? $this->input((string) $column) : $user?->{(string) $column};
            if ($column !== null && ($scopeValue === null || $scopeValue === '')) {
                $validator->errors()->add($column, "{$column} is required for role {$role->value}.");
            }
        }];
    }
}
