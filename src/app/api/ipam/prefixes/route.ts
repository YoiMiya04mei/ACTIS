import { NextRequest } from "next/server";
import {
  handleGetPrefixes,
  handleCreatePrefix,
  handleDeletePrefixRoute,
  handleResetPrefixesRoute,
} from "@/lib/ipamPrefixRouteHandler";

export async function GET(request: NextRequest) {
  return handleGetPrefixes(request, "public");
}

export async function POST(request: NextRequest) {
  return handleCreatePrefix(request, "public");
}

export async function DELETE(request: NextRequest) {
  return handleDeletePrefixRoute(request, "public");
}

export async function PUT(request: NextRequest) {
  return handleResetPrefixesRoute(request, "public");
}
