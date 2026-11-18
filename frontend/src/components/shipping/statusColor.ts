/** Maps a normalized shipment/tracking status to a Tailwind badge palette (spec 04 §4.2). */
export function shipmentStatusColor(status: string): string {
  switch (status) {
    case 'delivered':
      return 'bg-positive/15 text-positive';
    case 'out_for_delivery':
    case 'in_transit':
    case 'picked_up':
    case 'at_origin_hub':
    case 'at_destination_hub':
    case 'customs_clearance':
      return 'bg-notice/15 text-notice';
    case 'label_purchased':
    case 'awaiting_pickup':
    case 'rated':
      return 'bg-notice/15 text-notice';
    case 'draft':
      return 'bg-muted text-muted-foreground';
    case 'delivery_attempted':
    case 'held':
    case 'exception':
      return 'bg-caution/15 text-caution';
    case 'returned_to_origin':
    case 'rto_in_transit':
    case 'rto_delivered':
    case 'lost':
    case 'damaged':
      return 'bg-negative/15 text-negative';
    case 'cancelled':
      return 'bg-muted text-muted-foreground line-through';
    default:
      return 'bg-muted text-muted-foreground';
  }
}
