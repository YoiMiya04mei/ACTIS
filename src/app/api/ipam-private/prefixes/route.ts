import { NextRequest } from "next/server";
import {
  handleGetPrefixes,
  handleCreatePrefix,
  handleDeletePrefixRoute,
  handleResetPrefixesRoute,
} from "@/lib/ipamPrefixRouteHandler";

export async function GET(request: NextRequest) {
  return handleGetPrefixes(request, "private");
}

export async function POST(request: NextRequest) {
  return handleCreatePrefix(request, "private");
}

export async function DELETE(request: NextRequest) {
  return handleDeletePrefixRoute(request, "private");
}

export async function PUT(request: NextRequest) {
  return handleResetPrefixesRoute(request, "private");
}
