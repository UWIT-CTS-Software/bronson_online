// @generated automatically by Diesel CLI.

pub mod bronson {
    pub mod sql_types {
        #[derive(diesel::query_builder::QueryId, Clone, diesel::sql_types::SqlType)]
        #[diesel(postgres_type(name = "ip_address", schema = "bronson"))]
        pub struct IpAddress;
    }

    diesel::table! {
        bronson.buildings (abbrev) {
            abbrev -> Text,
            name -> Text,
            lsm_name -> Text,
            zone -> Int2,
            total_rooms -> Int2,
            checked_rooms -> Int2,
        }
    }

    diesel::table! {
        bronson.data (key) {
            key -> Text,
            val -> Text,
        }
    }

    diesel::table! {
        bronson.keys (key_id) {
            key_id -> Text,
            val -> Text,
        }
    }

    diesel::table! {
        use diesel::sql_types::*;
        use super::sql_types::IpAddress;

        bronson.rooms (name) {
            abbrev -> Text,
            name -> Text,
            checked -> Text,
            needs_checked -> Bool,
            gp -> Bool,
            available -> Bool,
            until -> Text,
            ping_data -> Array<Nullable<IpAddress>>,
            schedule -> Array<Nullable<Text>>,
        }
    }

    diesel::table! {
        bronson.tickets (ticket_id) {
            ticket_id -> Int4,
            has_been_viewed -> Bool,
            type_name -> Text,
            type_category_name -> Text,
            title -> Text,
            account_name -> Text,
            status_name -> Text,
            service_name -> Text,
            priority_name -> Text,
            created_date -> Text,
            created_full_name -> Text,
            modified_date -> Text,
            modified_full_name -> Text,
            requestor_name -> Text,
            requestor_email -> Text,
            requestor_phone -> Text,
            days_old -> Int2,
            responsible_full_name -> Text,
            responsible_group_name -> Text,
            old_type_name -> Text,
            old_type_category_name -> Text,
            old_title -> Text,
            old_account_name -> Text,
            old_status_name -> Text,
            old_service_name -> Text,
            old_priority_name -> Text,
            old_modified_date -> Text,
            old_modified_full_name -> Text,
            old_responsible_full_name -> Text,
            old_responsible_group_name -> Text,
        }
    }

    diesel::table! {
        bronson.users (username) {
            username -> Text,
            permissions -> Int2,
        }
    }

    diesel::joinable!(rooms -> buildings (abbrev));

    diesel::allow_tables_to_appear_in_same_query!(
        buildings,
        data,
        keys,
        rooms,
        tickets,
        users,
    );
}
