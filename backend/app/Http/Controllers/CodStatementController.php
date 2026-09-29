<?php

namespace App\Http\Controllers;

use App\Models\CodTransaction;
use App\Models\Organization;
use App\Services\Cod\CodTransactionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CodStatementController extends Controller
{
    private function authorizeManage(Request $r): int
    {
        $org = Organization::findOrFail($r->header('X-Organization-Id'));
        $role = $org->users()->where('users.id', $r->user()->id)->first()?->pivot->role;
        abort_unless(in_array($role, ['owner', 'admin']), 403);

        return $org->id;
    }

    public function index(Request $r)
    {
        $org = $this->authorizeManage($r);

        return response()->json(DB::table('cod_statements')->where('organization_id', $org)->latest('id')->paginate(20));
    }

    public function preview(Request $r)
    {
        $org = $this->authorizeManage($r);
        $data = $r->validate(['carrier_code' => 'required|string|max:50', 'reference' => 'required|string|max:100', 'file' => 'required|file|max:2048']);
        $existing = DB::table('cod_statements')->where('organization_id', $org)->where('carrier_code', $data['carrier_code'])->where('reference', $data['reference'])->first();
        abort_if($existing, 409, 'This statement reference has already been imported.');
        $file = fopen($r->file('file')->getRealPath(), 'r');
        try {
            $header = fgetcsv($file);
            if ($header) {
                $header[0] = preg_replace('/^\xEF\xBB\xBF/', '', $header[0]);
            }
            if ($header !== ['awb', 'currency', 'amount']) {
                throw ValidationException::withMessages(['file' => 'CSV header must be awb,currency,amount. Amount must be the gross COD remittance before carrier fees.']);
            }
            $rows = [];
            $seen = [];
            while (($line = fgetcsv($file)) !== false) {
                if ($line === [null]) {
                    continue;
                }
                if (count($rows) >= 1000 || count($line) !== 3 || ! preg_match('/^\d{1,10}(\.\d{1,2})?$/', trim($line[2])) || ! preg_match('/^[A-Z]{3}$/', trim($line[1]))) {
                    throw ValidationException::withMessages(['file' => 'Invalid row or more than 1000 rows. Use positive amounts with up to 2 decimals and uppercase currency codes.']);
                }
                $awb = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', $line[0]));
                if (! $awb || isset($seen[$awb])) {
                    throw ValidationException::withMessages(['file' => 'Empty or duplicate AWB in statement.']);
                }
                $seen[$awb] = true;
                $row = ['awb' => $awb, 'currency' => trim($line[1]), 'amount' => trim($line[2])];
                $rows[] = $this->match($org, $data['carrier_code'], $row, false);
            }
        } finally {
            fclose($file);
        }
        if (! $rows) {
            throw ValidationException::withMessages(['file' => 'The statement is empty.']);
        }
        $id = DB::table('cod_statements')->insertGetId(['organization_id' => $org, 'created_by' => $r->user()->id, 'carrier_code' => $data['carrier_code'], 'reference' => $data['reference'], 'rows' => json_encode($rows), 'status' => 'preview', 'created_at' => now(), 'updated_at' => now()]);

        return response()->json(['id' => $id, 'rows' => $rows, 'status' => 'preview'], 201);
    }

    public function apply(Request $r, int $id)
    {
        $org = $this->authorizeManage($r);

        return DB::transaction(function () use ($org, $id) {
            $statement = DB::table('cod_statements')->where('organization_id', $org)->where('id', $id)->lockForUpdate()->first();
            abort_unless($statement, 404);
            if ($statement->applied_at) {
                return response()->json(['id' => $id, 'rows' => json_decode($statement->rows), 'status' => $statement->status]);
            }
            $rows = array_map(fn ($row) => $this->match($org, $statement->carrier_code, $row, true), json_decode($statement->rows, true));
            DB::table('cod_statements')->where('id', $id)->update(['rows' => json_encode($rows), 'status' => 'applied', 'applied_at' => now(), 'updated_at' => now()]);

            return response()->json(['id' => $id, 'rows' => $rows, 'status' => 'applied']);
        });
    }

    private function match(int $org, string $carrier, array $row, bool $apply): array
    {
        $query = CodTransaction::where('organization_id', $org)->where('carrier_code', $carrier)->where('awb_number', $row['awb']);
        if ($apply) {
            $query->lockForUpdate();
        }
        $matches = $query->get();
        $txn = $matches->count() === 1 ? $matches->first() : null;
        $status = ! $txn ? ($matches->isEmpty() ? 'unmatched' : 'ambiguous') : ($txn->currency !== $row['currency'] ? 'currency_mismatch' : ($txn->status !== 'collected' ? 'ineligible' : (abs((float) $txn->collected_amount - (float) $row['amount']) >= 0.005 ? 'discrepancy' : 'matched')));
        if ($status === 'matched' && $apply) {
            app(CodTransactionService::class)->markRemitted($txn, (float) $row['amount']);
            $status = 'applied';
        }

        return ['awb' => $row['awb'], 'currency' => $row['currency'], 'amount' => $row['amount'], 'status' => $status, 'transaction_id' => $txn?->id, 'expected' => $txn?->collected_amount];
    }
}
