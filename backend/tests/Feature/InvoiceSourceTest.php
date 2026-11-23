<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InvoiceSourceTest extends TestCase
{
    use RefreshDatabase;

    public function test_an_organisation_can_move_invoicing_to_its_accounting_system(): void
    {
        $user = User::factory()->create();
        $org = $this->makeOrganization($user);
        $user->organizations()->attach($org->id, ['role' => 'owner']);
        $this->actingAs($user)->withHeader('X-Organization-Id', $org->id);

        $this->getJson('/api/invoice-source')->assertOk()->assertExactJson(['invoice_source' => 'hubby']);
        $this->putJson('/api/invoice-source', ['invoice_source' => 'somewhere'])->assertStatus(422);
        $this->putJson('/api/invoice-source', ['invoice_source' => 'accounting'])->assertOk();

        // No second invoice for the same sale: creating one here is refused with a clear reason.
        $this->postJson('/api/invoices', ['order_id' => 1])
            ->assertStatus(422)->assertJsonPath('code', 'INVOICES_FROM_ACCOUNTING');
        $this->assertDatabaseCount('invoices', 0);
    }

    public function test_only_an_owner_or_admin_can_change_it(): void
    {
        $owner = User::factory()->create();
        $org = $this->makeOrganization($owner);
        $staff = User::factory()->create();
        $staff->organizations()->attach($org->id, ['role' => 'staff']);

        $this->actingAs($staff)->withHeader('X-Organization-Id', $org->id)
            ->putJson('/api/invoice-source', ['invoice_source' => 'accounting'])->assertForbidden();
        $this->assertSame('hubby', $org->fresh()->invoice_source);
    }
}
