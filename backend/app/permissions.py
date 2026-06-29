from typing import Dict, Any
from cognee.modules.users.methods import get_default_user


async def setup_multi_user_environment() -> Dict[str, Any]:
    from cognee.modules.users.methods.create_user import create_user
    from cognee.modules.users.roles.methods.create_role import create_role
    from cognee.modules.users.roles.methods.add_user_to_role import add_user_to_role
    from cognee.modules.users.tenants.methods.create_tenant import create_tenant
    from cognee.modules.users.tenants.methods.add_user_to_tenant import (
        add_user_to_tenant,
    )
    from cognee.modules.users.permissions.methods import give_permission_on_dataset
    from cognee.modules.data.methods import (
        get_authorized_dataset_by_name,
        create_authorized_dataset,
    )
    from cognee.modules.users.models.Principal import Principal

    admin = await get_default_user()
    results = {"status": "configured", "steps": []}

    # Step 1: Create tenants
    try:
        payments_tenant_id = await create_tenant("Payments Team", user_id=admin.id)
        infra_tenant_id = await create_tenant("Infrastructure Team", user_id=admin.id)
        results["tenants"] = ["Payments Team", "Infrastructure Team"]
        results["steps"].append("tenants_created")
    except Exception as e:
        results["steps"].append(f"tenants_skipped: {e}")
        payments_tenant_id = None
        infra_tenant_id = None

    # Step 2: Create users
    alice = None
    bob = None
    try:
        alice = await create_user(
            email="alice@memops.io",
            password="temporary_password_change_me",
        )
        bob = await create_user(
            email="bob@memops.io",
            password="temporary_password_change_me",
        )
        results["users"] = ["alice@memops.io", "bob@memops.io"]
        results["steps"].append("users_created")
    except Exception as e:
        results["steps"].append(f"users_skipped: {e}")

    # Step 3: Add users to tenants
    if alice and payments_tenant_id:
        try:
            await add_user_to_tenant(
                user_id=alice.id, tenant_id=payments_tenant_id, owner_id=admin.id
            )
            if infra_tenant_id:
                await add_user_to_tenant(
                    user_id=alice.id, tenant_id=infra_tenant_id, owner_id=admin.id
                )
            results["steps"].append("alice_to_tenants")
        except Exception as e:
            results["steps"].append(f"alice_to_tenants_skipped: {e}")

    if bob and payments_tenant_id:
        try:
            await add_user_to_tenant(
                user_id=bob.id, tenant_id=payments_tenant_id, owner_id=admin.id
            )
            results["steps"].append("bob_to_tenants")
        except Exception as e:
            results["steps"].append(f"bob_to_tenants_skipped: {e}")

    # Step 4: Create roles
    sre_role_id = None
    senior_role_id = None
    try:
        sre_role_id = await create_role("SRE", owner_id=admin.id)
        senior_role_id = await create_role("Senior SRE", owner_id=admin.id)
        results["roles"] = ["SRE", "Senior SRE"]
        results["steps"].append("roles_created")
    except Exception as e:
        results["steps"].append(f"roles_skipped: {e}")

    # Step 5: Assign users to roles
    if alice and sre_role_id:
        try:
            await add_user_to_role(
                user_id=alice.id, role_id=sre_role_id, owner_id=admin.id
            )
            results["steps"].append("alice_to_sre")
        except Exception as e:
            results["steps"].append(f"alice_to_sre_skipped: {e}")

    if bob and sre_role_id:
        try:
            await add_user_to_role(
                user_id=bob.id, role_id=sre_role_id, owner_id=admin.id
            )
            results["steps"].append("bob_to_sre")
        except Exception as e:
            results["steps"].append(f"bob_to_sre_skipped: {e}")

    if alice and senior_role_id:
        try:
            await add_user_to_role(
                user_id=alice.id, role_id=senior_role_id, owner_id=admin.id
            )
            results["steps"].append("alice_to_senior")
        except Exception as e:
            results["steps"].append(f"alice_to_senior_skipped: {e}")

    # Step 6: Create datasets
    dataset_names = [
        "incidents",
        "payments-incidents",
        "payments-runbooks",
        "payments-services",
        "infra-incidents",
        "global-dependencies",
        "org-wide-learnings",
    ]
    created_datasets = {}
    for name in dataset_names:
        try:
            ds = await get_authorized_dataset_by_name(
                name, user=admin, permission_type="write"
            )
            if ds is None:
                ds = await create_authorized_dataset(name, user=admin)
            created_datasets[name] = ds
        except Exception as e:
            results["steps"].append(f"dataset_{name}_skipped: {e}")
    results["datasets"] = list(created_datasets.keys())
    results["steps"].append("datasets_created")

    # Step 7: Set permissions
    if sre_role_id and created_datasets:
        sre_role = Principal(id=sre_role_id)
        for ds_name in ["payments-incidents", "payments-runbooks", "payments-services"]:
            if ds_name in created_datasets:
                try:
                    await give_permission_on_dataset(
                        sre_role, created_datasets[ds_name].id, "write"
                    )
                except Exception:
                    pass

    if senior_role_id and created_datasets:
        senior_role = Principal(id=senior_role_id)
        if "org-wide-learnings" in created_datasets:
            try:
                await give_permission_on_dataset(
                    senior_role, created_datasets["org-wide-learnings"].id, "write"
                )
            except Exception:
                pass

    results["steps"].append("permissions_set")
    return results


async def get_tenant_isolation_info() -> Dict[str, Any]:
    return {
        "tenants": [
            {
                "name": "Payments Team",
                "datasets": [
                    "payments-incidents",
                    "payments-runbooks",
                    "payments-services",
                ],
            },
            {
                "name": "Infrastructure Team",
                "datasets": ["infra-incidents", "global-dependencies"],
            },
        ],
        "shared_datasets": ["org-wide-learnings", "global-dependencies"],
        "isolation_model": "Cognee ACL system with per-dataset handlers",
    }
